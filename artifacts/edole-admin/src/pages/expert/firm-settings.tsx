import { useState, useEffect } from "react";
import { useActiveFirm, useExpertMembers, useUpdateFirm, useRemoveMember, useInviteFirmMember } from "@/lib/expert-api";
import { apiFetch } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { Building2, Users2, Save, Trash2, AlertCircle, UserPlus, Bell } from "lucide-react";

function InviteModal({ firmId, open, onClose }: { firmId: string; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const invite = useInviteFirmMember(firmId);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", role: "member" });
  const f = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    invite.mutate(form, {
      onSuccess: () => {
        toast({ title: "Invitation envoyée", description: "Un e-mail d'invitation a été envoyé." });
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
            <Select value={form.role} onValueChange={(v) => f("role", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Collaborateur</SelectItem>
                <SelectItem value="admin">Administrateur</SelectItem>
              </SelectContent>
            </Select>
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

export default function FirmSettingsPage() {
  const { firmId, activeFirm } = useActiveFirm();
  const { data: members, isLoading: loadMembers } = useExpertMembers(firmId);
  const { toast } = useToast();
  const qc = useQueryClient();

  const updateFirm = useUpdateFirm(firmId ?? "");
  const removeMember = useRemoveMember(firmId ?? "");

  const [form, setForm] = useState({ name: "", country: "", email: "", phone: "", address: "" });
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [confirmRemove, setConfirmRemove] = useState<{ userId: string; name: string } | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (activeFirm) {
      setForm({
        name: activeFirm.name ?? "",
        country: activeFirm.country ?? "",
        email: activeFirm.email ?? "",
        phone: activeFirm.phone ?? "",
        address: activeFirm.address ?? "",
      });
      setNotificationsEnabled(activeFirm.notificationsEnabled ?? true);
      setDirty(false);
    }
  }, [activeFirm?.id]);

  const f = (k: keyof typeof form, v: string) => { setForm((p) => ({ ...p, [k]: v })); setDirty(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firmId) return;
    try {
      await updateFirm.mutateAsync({ ...form, notificationsEnabled });
      toast({ title: "Cabinet mis à jour" });
      setDirty(false);
    } catch (err: any) {
      toast({ title: "Erreur", description: err?.body?.error, variant: "destructive" });
    }
  };

  const handleRemove = async () => {
    if (!confirmRemove || !firmId) return;
    try {
      await removeMember.mutateAsync(confirmRemove.userId);
      toast({ title: "Collaborateur retiré" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err?.body?.error, variant: "destructive" });
    }
    setConfirmRemove(null);
  };

  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      apiFetch(`/api/expert/firms/${firmId}/members/${userId}`, { method: "PATCH", body: { role } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expert/members", firmId] });
      toast({ title: "Rôle mis à jour" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.body?.error, variant: "destructive" }),
  });

  if (!firmId || !activeFirm) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Aucun cabinet sélectionné.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mon cabinet</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Informations et gestion des membres</p>
      </div>

      {/* Firm info form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />Informations du cabinet
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nom du cabinet *</Label>
                <Input value={form.name} onChange={(e) => f("name", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Pays</Label>
                <Input value={form.country} onChange={(e) => f("country", e.target.value)} maxLength={3} placeholder="TG" />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input type="email" value={form.email} onChange={(e) => f("email", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Téléphone</Label>
                <Input value={form.phone} onChange={(e) => f("phone", e.target.value)} />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Adresse</Label>
                <Input value={form.address} onChange={(e) => f("address", e.target.value)} placeholder="123 Rue du Commerce, Lomé" />
              </div>
            </div>

            <div className="border rounded-lg px-4 py-3.5 flex items-center justify-between gap-4 bg-muted/30">
              <div className="flex items-center gap-2.5 min-w-0">
                <Bell className="w-4 h-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">Notifications email — dépôt de document</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Envoyer un email aux membres du cabinet quand un client dépose un document.
                  </p>
                </div>
              </div>
              <Switch
                checked={notificationsEnabled}
                onCheckedChange={(v) => { setNotificationsEnabled(v); setDirty(true); }}
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={updateFirm.isPending || !dirty}>
                <Save className="w-4 h-4 mr-2" />
                {updateFirm.isPending ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users2 className="w-4 h-4 text-primary" />Collaborateurs du cabinet
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" />Inviter un collaborateur
            </Button>
          </div>
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
                  <div key={m.id} className="flex items-center gap-3 py-3 px-2 rounded-lg hover:bg-muted/40 transition-colors">
                    <Avatar className="w-9 h-9 shrink-0">
                      <AvatarFallback className="text-[12px] bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
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
                      <SelectTrigger className="w-36 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Propriétaire</SelectItem>
                        <SelectItem value="admin">Administrateur</SelectItem>
                        <SelectItem value="member">Membre</SelectItem>
                      </SelectContent>
                    </Select>
                    {m.role !== "owner" && (
                      <Button
                        variant="ghost" size="sm"
                        className="h-8 w-8 p-0 text-destructive/50 hover:text-destructive hover:bg-destructive/10"
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

      <ConfirmDialog
        open={!!confirmRemove}
        onOpenChange={(o) => { if (!o) setConfirmRemove(null); }}
        title="Retirer ce collaborateur ?"
        description={`"${confirmRemove?.name}" n'aura plus accès au cabinet.`}
        confirmLabel="Retirer"
        destructive
        onConfirm={handleRemove}
      />

      {firmId && (
        <InviteModal firmId={firmId} open={inviteOpen} onClose={() => setInviteOpen(false)} />
      )}
    </div>
  );
}
