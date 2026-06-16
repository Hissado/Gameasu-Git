import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Users, UserPlus, Mail, Calendar, CheckCircle2, XCircle,
  Loader2, ShieldCheck, MoreHorizontal, Trash2, PowerOff, Power,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type CockpitUser = {
  id: string; email: string; firstName: string; lastName: string;
  isActive: boolean; lastLoginAt: string | null;
  createdAt: string; invitedAt: string | null; acceptedAt: string | null;
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDatetime(d: string | null) {
  if (!d) return "Jamais";
  return new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function CockpitUsersPage() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["cockpit-users"],
    queryFn: () => apiFetch<{ count: number; rows: CockpitUser[] }>("/api/super-admin/cockpit-users"),
  });

  const inviteMut = useMutation({
    mutationFn: (body: typeof form) => apiFetch("/api/super-admin/cockpit-users/invite", {
      method: "POST", body: JSON.stringify(body),
    }),
    onSuccess: () => {
      toast.success("Invitation envoyée avec succès");
      qc.invalidateQueries({ queryKey: ["cockpit-users"] });
      setInviteOpen(false);
      setForm({ email: "", firstName: "", lastName: "" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur lors de l'invitation"),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiFetch(`/api/super-admin/cockpit-users/${id}/status`, { method: "PATCH", body: JSON.stringify({ isActive }) }),
    onSuccess: (_d, vars) => {
      toast.success(vars.isActive ? "Accès réactivé" : "Accès désactivé");
      qc.invalidateQueries({ queryKey: ["cockpit-users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/super-admin/cockpit-users/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Accès révoqué"); qc.invalidateQueries({ queryKey: ["cockpit-users"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const rows = data?.rows ?? [];

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Équipe Cockpit</h1>
          <p className="page-subtitle">Gérez les membres qui ont accès au Cockpit d'administration Gaméasù</p>
        </div>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="w-4 h-4" />
              Inviter un membre
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Inviter un membre de l'équipe</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Prénom</Label>
                  <Input placeholder="Jean" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Nom</Label>
                  <Input placeholder="Dupont" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Adresse email</Label>
                <Input type="email" placeholder="jean.dupont@gameasu.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <p className="text-xs text-muted-foreground">Un email d'invitation avec les identifiants temporaires sera envoyé. L'utilisateur aura accès à l'ensemble du Cockpit avec le rôle Super Admin.</p>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setInviteOpen(false)}>Annuler</Button>
                <Button
                  onClick={() => inviteMut.mutate(form)}
                  disabled={inviteMut.isPending || !form.email || !form.firstName || !form.lastName}
                >
                  {inviteMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Envoyer l'invitation"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <Card className="premium-card">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="stat-value text-2xl">{data?.count ?? 0}</p>
                <p className="stat-label">Membres total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="premium-card">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="stat-value text-2xl">{rows.filter(r => r.isActive).length}</p>
                <p className="stat-label">Actifs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="premium-card">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="stat-value text-2xl">{rows.filter(r => !r.acceptedAt).length}</p>
                <p className="stat-label">En attente</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="premium-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Membres de l'équipe</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucun membre dans l'équipe Cockpit</p>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Membre</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Rôle</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Dernière connexion</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Statut</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(u => {
                    const isSelf = u.id === me?.id;
                    return (
                      <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-primary">
                                {u.firstName?.[0]?.toUpperCase()}{u.lastName?.[0]?.toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium">{u.firstName} {u.lastName} {isSelf && <span className="text-xs text-muted-foreground">(vous)</span>}</p>
                              <p className="text-xs text-muted-foreground">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <Badge variant="outline" className="text-xs gap-1">
                            <ShieldCheck className="w-3 h-3" /> Super Admin
                          </Badge>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                          {fmtDatetime(u.lastLoginAt)}
                        </td>
                        <td className="px-4 py-3">
                          {!u.acceptedAt ? (
                            <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">En attente</Badge>
                          ) : u.isActive ? (
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">Actif</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">Inactif</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {!isSelf && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {u.isActive ? (
                                  <DropdownMenuItem
                                    className="text-amber-600"
                                    onClick={() => statusMut.mutate({ id: u.id, isActive: false })}
                                  >
                                    <PowerOff className="w-4 h-4 mr-2" /> Désactiver
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    className="text-emerald-600"
                                    onClick={() => statusMut.mutate({ id: u.id, isActive: true })}
                                  >
                                    <Power className="w-4 h-4 mr-2" /> Réactiver
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => { if (confirm(`Révoquer l'accès de ${u.email} ?`)) revokeMut.mutate(u.id); }}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" /> Révoquer l'accès
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
