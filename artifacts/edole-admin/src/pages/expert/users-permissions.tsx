import { useState } from "react";
import { useLocation } from "wouter";
import { useActiveFirm, useExpertMembers, useExpertClients, useRemoveMember, useInviteClientMember, useUpdateClientMemberRole, useRemoveClientMember } from "@/lib/expert-api";
import { apiFetch } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Users2, Building2, Trash2, AlertCircle } from "lucide-react";

const MEMBER_ROLE_LABEL: Record<string, string> = {
  owner: "Propriétaire",
  admin: "Administrateur",
  member: "Membre",
};
const MEMBER_ROLE_COLOR: Record<string, string> = {
  owner: "bg-amber-50 text-amber-700 border-amber-200",
  admin: "bg-blue-50 text-blue-700 border-blue-200",
  member: "bg-slate-50 text-slate-600 border-slate-200",
};

function InviteFirmMemberModal({ firmId, open, onClose }: { firmId: string; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ userId: "", role: "member" });

  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch<{ data: any[] }>("/api/users?limit=200"),
  });

  const invite = useMutation({
    mutationFn: (body: { userId: string; role: string }) =>
      apiFetch(`/api/expert/firms/${firmId}/members`, { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expert/members", firmId] });
      toast({ title: "Membre ajouté au cabinet" });
      onClose();
      setForm({ userId: "", role: "member" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.body?.error, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Ajouter un collaborateur au cabinet</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); if (form.userId) invite.mutate(form); }} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Utilisateur</Label>
            <Select value={form.userId} onValueChange={(v) => setForm({ ...form, userId: v })}>
              <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
              <SelectContent>
                {(usersData?.data ?? []).map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Rôle</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrateur</SelectItem>
                <SelectItem value="member">Membre</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={invite.isPending || !form.userId}>
              {invite.isPending ? "Ajout…" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InviteClientMemberModal({
  firmId, orgId, orgName, open, onClose,
}: { firmId: string; orgId: string; orgName: string; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", role: "member" });
  const invite = useInviteClientMember(firmId, orgId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.email) return;
    invite.mutate(form, {
      onSuccess: () => {
        toast({ title: "Invitation envoyée", description: `Un e-mail d'invitation a été envoyé à ${form.email}` });
        onClose();
        setForm({ firstName: "", lastName: "", email: "", role: "member" });
      },
      onError: (e: any) => toast({ title: "Erreur", description: e?.body?.error ?? "Invitation impossible", variant: "destructive" }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Inviter un membre — {orgName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prénom</Label>
              <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="Jean" required />
            </div>
            <div className="space-y-1.5">
              <Label>Nom</Label>
              <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Dupont" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Adresse e-mail</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jean.dupont@exemple.com" required />
          </div>
          <div className="space-y-1.5">
            <Label>Rôle</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrateur</SelectItem>
                <SelectItem value="member">Membre</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">Un e-mail d'invitation avec un lien d'activation sera envoyé.</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={invite.isPending || !form.firstName || !form.lastName || !form.email}>
              {invite.isPending ? "Envoi…" : "Envoyer l'invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function UsersPermissionsPage() {
  const [location] = useLocation();
  const params = new URLSearchParams(location.includes("?") ? location.split("?")[1] : "");
  const orgId = params.get("orgId");

  const { firmId } = useActiveFirm();
  const { data: members, isLoading: loadMembers } = useExpertMembers(firmId);
  const { data: clients } = useExpertClients(firmId);
  const removeMember = useRemoveMember(firmId ?? "");
  const { toast } = useToast();
  const qc = useQueryClient();

  const updateClientRole = useUpdateClientMemberRole(firmId, orgId);
  const removeClientMember = useRemoveClientMember(firmId, orgId);

  const [inviteFirmOpen, setInviteFirmOpen] = useState(false);
  const [inviteClientOpen, setInviteClientOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<{ userId: string; name: string } | null>(null);
  const [confirmRemoveClient, setConfirmRemoveClient] = useState<{ userId: string; name: string } | null>(null);

  const { data: orgUsers } = useQuery({
    queryKey: ["expert/org-users", firmId, orgId],
    queryFn: () => apiFetch<any[]>(`/api/expert/firms/${firmId}/clients/${orgId}/users`),
    enabled: !!firmId && !!orgId,
  });

  const selectedOrg = clients?.find((c) => c.orgId === orgId);

  const handleRemove = async () => {
    if (!confirmRemove || !firmId) return;
    try {
      await removeMember.mutateAsync(confirmRemove.userId);
      toast({ title: "Collaborateur retiré du cabinet" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err?.body?.error, variant: "destructive" });
    }
    setConfirmRemove(null);
  };

  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      apiFetch(`/api/expert/firms/${firmId}/members/${userId}`, { method: "PATCH", body: { role } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expert/members", firmId] }),
    onError: (e: any) => toast({ title: "Erreur", description: e?.body?.error, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Utilisateurs &amp; permissions</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Membres du cabinet et accès clients</p>
      </div>

      {/* Cabinet members */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users2 className="w-4 h-4 text-primary" />Membres du cabinet
          </CardTitle>
          <Button size="sm" onClick={() => setInviteFirmOpen(true)}>
            <UserPlus className="w-4 h-4 mr-1.5" />Ajouter
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {loadMembers ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : !members?.length ? (
            <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Aucun membre dans ce cabinet.</span>
            </div>
          ) : (
            <div className="space-y-1">
              {members.map((m) => {
                const name = m.user ? `${m.user.firstName} ${m.user.lastName}` : m.userId;
                const initials = m.user ? (m.user.firstName[0] + m.user.lastName[0]).toUpperCase() : "?";
                return (
                  <div key={m.id} className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-muted/40">
                    <Avatar className="w-8 h-8 shrink-0">
                      <AvatarFallback className="text-[11px] bg-primary/10 text-primary">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{name}</p>
                      {m.user?.email && <p className="text-xs text-muted-foreground truncate">{m.user.email}</p>}
                    </div>
                    <Select
                      value={m.role}
                      onValueChange={(v) => updateRole.mutate({ userId: m.userId, role: v })}
                      disabled={m.role === "owner"}
                    >
                      <SelectTrigger className="w-36 h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Propriétaire</SelectItem>
                        <SelectItem value="admin">Administrateur</SelectItem>
                        <SelectItem value="member">Membre</SelectItem>
                      </SelectContent>
                    </Select>
                    {m.role !== "owner" && (
                      <Button
                        variant="ghost" size="sm"
                        className="h-7 w-7 p-0 text-destructive/50 hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setConfirmRemove({ userId: m.userId, name })}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Org members (if a client org is selected) */}
      {orgId && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              Utilisateurs — {selectedOrg?.org.name ?? orgId}
            </CardTitle>
            {firmId && orgId && (
              <Button size="sm" variant="outline" onClick={() => setInviteClientOpen(true)}>
                <UserPlus className="w-4 h-4 mr-1.5" />Inviter un membre
              </Button>
            )}
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {!orgUsers?.length ? (
              <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Aucun utilisateur trouvé pour cette organisation.</span>
              </div>
            ) : (
              <div className="space-y-1">
                {(orgUsers ?? []).map((u: any) => {
                  const initials = ((u.firstName?.[0] ?? "") + (u.lastName?.[0] ?? "")).toUpperCase() || "?";
                  const fullName = `${u.firstName} ${u.lastName}`.trim();
                  return (
                    <div key={u.id} className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-muted/40">
                      <Avatar className="w-8 h-8 shrink-0">
                        <AvatarFallback className="text-[11px] bg-slate-100 text-slate-600">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{fullName}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                      <Badge className={`text-[10px] ${u.isActive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`} variant="outline">
                        {u.isActive ? "Actif" : "Inactif"}
                      </Badge>
                      {u.role !== "owner" ? (
                        <Select
                          value={u.role ?? "member"}
                          onValueChange={(v) => updateClientRole.mutate({ userId: u.id, role: v }, {
                            onSuccess: () => toast({ title: "Rôle mis à jour" }),
                            onError: (err: any) => toast({ title: "Erreur", description: err?.body?.error, variant: "destructive" }),
                          })}
                          disabled={updateClientRole.isPending}
                        >
                          <SelectTrigger className="w-34 h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Administrateur</SelectItem>
                            <SelectItem value="member">Membre</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={`text-[10px] border ${MEMBER_ROLE_COLOR["owner"]}`} variant="outline">
                          Propriétaire
                        </Badge>
                      )}
                      {u.role !== "owner" && (
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 w-7 p-0 text-destructive/50 hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setConfirmRemoveClient({ userId: u.id, name: fullName })}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {firmId && <InviteFirmMemberModal firmId={firmId} open={inviteFirmOpen} onClose={() => setInviteFirmOpen(false)} />}
      {firmId && orgId && (
        <InviteClientMemberModal
          firmId={firmId}
          orgId={orgId}
          orgName={selectedOrg?.org.name ?? orgId}
          open={inviteClientOpen}
          onClose={() => setInviteClientOpen(false)}
        />
      )}

      <ConfirmDialog
        open={!!confirmRemove}
        onOpenChange={(o) => { if (!o) setConfirmRemove(null); }}
        title="Retirer ce collaborateur ?"
        description={`"${confirmRemove?.name}" n'aura plus accès au cabinet.`}
        confirmLabel="Retirer"
        destructive
        onConfirm={handleRemove}
      />

      <ConfirmDialog
        open={!!confirmRemoveClient}
        onOpenChange={(o) => { if (!o) setConfirmRemoveClient(null); }}
        title="Retirer cet utilisateur ?"
        description={`"${confirmRemoveClient?.name}" sera retiré de l'organisation. Ses données ne seront pas supprimées.`}
        confirmLabel="Retirer"
        destructive
        onConfirm={async () => {
          if (!confirmRemoveClient) return;
          try {
            await removeClientMember.mutateAsync(confirmRemoveClient.userId);
            toast({ title: "Utilisateur retiré" });
          } catch (err: any) {
            toast({ title: "Erreur", description: err?.body?.error, variant: "destructive" });
          }
          setConfirmRemoveClient(null);
        }}
      />
    </div>
  );
}
