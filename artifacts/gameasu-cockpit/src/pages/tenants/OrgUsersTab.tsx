import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Loader2, UserPlus, Search, Mail, Phone, MoreVertical,
  CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw,
  KeyRound, UserCheck, UserX, Send,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type UserRow = {
  userId: string;
  role: string;
  isPrimary: boolean;
  joinedAt: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  userRole: string | null;
  isActive: boolean | null;
  lastLoginAt: string | null;
  mustChangePassword: boolean | null;
  hasResetToken: boolean | null;
  invitedAt: string | null;
};

type EditForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES = [
  { value: "owner",         label: "Propriétaire" },
  { value: "admin",         label: "Administrateur" },
  { value: "manager",       label: "Manager" },
  { value: "member",        label: "Membre" },
  { value: "collaborator",  label: "Collaborateur" },
  { value: "accountant",    label: "Comptable" },
  { value: "commercial",    label: "Commercial" },
  { value: "viewer",        label: "Lecteur" },
];

const ROLE_LABELS: Record<string, string> = Object.fromEntries(ROLES.map((r) => [r.value, r.label]));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateTime(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function getUserStatus(u: UserRow): { label: string; cls: string; icon: typeof CheckCircle2 } {
  if (!u.isActive) return { label: "Inactif", cls: "bg-gray-50 text-gray-500 border-gray-200", icon: XCircle };
  if (u.hasResetToken && u.mustChangePassword && !u.lastLoginAt) {
    return { label: "Invitation envoyée", cls: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock };
  }
  if (u.mustChangePassword) return { label: "Mot de passe requis", cls: "bg-orange-50 text-orange-700 border-orange-200", icon: AlertCircle };
  return { label: "Actif", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 };
}

function initials(u: UserRow) {
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ");
  return name ? name[0]!.toUpperCase() : (u.email?.[0]?.toUpperCase() ?? "?");
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OrgUsersTab({ orgId, orgName }: { orgId: string; orgName: string }) {
  const qc = useQueryClient();

  // ── Filters ──
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // ── Dialogs ──
  const [showAdd, setShowAdd] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ user: UserRow; action: "activate" | "deactivate" } | null>(null);

  // ── Add form ──
  const [addForm, setAddForm] = useState({ firstName: "", lastName: "", email: "", phone: "", role: "member" });
  const [saving, setSaving] = useState(false);

  // ── Edit form ──
  const [editForm, setEditForm] = useState<EditForm>({ firstName: "", lastName: "", email: "", phone: "", role: "member" });
  const [editSaving, setEditSaving] = useState(false);

  // ── Action states ──
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── Data ──
  const users = useQuery<{ rows: UserRow[] }>({
    queryKey: ["cockpit-org-users", orgId],
    queryFn: () => apiFetch(`/api/super-admin/organizations/${orgId}/users`),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["cockpit-org-users", orgId] });

  // ── Filtered rows ──
  const rows = useMemo(() => {
    let list = users.data?.rows ?? [];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((u) =>
        [u.firstName, u.lastName, u.email, u.phone].some((v) => v?.toLowerCase().includes(q))
      );
    }
    if (roleFilter !== "all") {
      list = list.filter((u) => u.role === roleFilter);
    }
    if (statusFilter !== "all") {
      list = list.filter((u) => {
        const st = getUserStatus(u).label;
        if (statusFilter === "actif") return st === "Actif";
        if (statusFilter === "inactif") return st === "Inactif";
        if (statusFilter === "invite") return st === "Invitation envoyée";
        return true;
      });
    }
    return list;
  }, [users.data, search, roleFilter, statusFilter]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleAdd = async () => {
    if (!addForm.firstName || !addForm.lastName || !addForm.email) {
      toast.error("Prénom, nom et email sont obligatoires");
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/super-admin/organizations/${orgId}/users`, {
        method: "POST",
        body: JSON.stringify(addForm),
      });
      toast.success(`Utilisateur ${addForm.firstName} ${addForm.lastName} créé — invitation envoyée`);
      setShowAdd(false);
      setAddForm({ firstName: "", lastName: "", email: "", phone: "", role: "member" });
      refresh();
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (u: UserRow) => {
    setEditForm({
      firstName: u.firstName ?? "",
      lastName: u.lastName ?? "",
      email: u.email ?? "",
      phone: u.phone ?? "",
      role: u.role ?? "member",
    });
    setEditUser(u);
  };

  const handleEdit = async () => {
    if (!editUser) return;
    setEditSaving(true);
    try {
      await apiFetch(`/api/super-admin/organizations/${orgId}/users/${editUser.userId}`, {
        method: "PATCH",
        body: JSON.stringify(editForm),
      });
      toast.success("Informations mises à jour");
      setEditUser(null);
      refresh();
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Erreur");
    } finally {
      setEditSaving(false);
    }
  };

  const handleActivate = async (u: UserRow) => {
    setActionLoading(`activate-${u.userId}`);
    try {
      await apiFetch(`/api/super-admin/organizations/${orgId}/users/${u.userId}/activate`, {
        method: "POST", body: JSON.stringify({}),
      });
      toast.success(`${u.firstName ?? u.email} réactivé`);
      refresh();
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Erreur");
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  };

  const handleDeactivate = async (u: UserRow) => {
    setActionLoading(`deactivate-${u.userId}`);
    try {
      await apiFetch(`/api/super-admin/organizations/${orgId}/users/${u.userId}/deactivate`, {
        method: "POST", body: JSON.stringify({}),
      });
      toast.success(`${u.firstName ?? u.email} désactivé`);
      refresh();
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Erreur");
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  };

  const handleResetPassword = async (u: UserRow) => {
    setActionLoading(`reset-${u.userId}`);
    try {
      await apiFetch(`/api/super-admin/organizations/${orgId}/users/${u.userId}/reset-password`, {
        method: "POST", body: JSON.stringify({}),
      });
      toast.success("Email de réinitialisation envoyé");
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Erreur");
    } finally {
      setActionLoading(null);
    }
  };

  const handleResendInvite = async (u: UserRow) => {
    setActionLoading(`invite-${u.userId}`);
    try {
      await apiFetch(`/api/super-admin/organizations/${orgId}/users/${u.userId}/resend-invite`, {
        method: "POST", body: JSON.stringify({}),
      });
      toast.success("Invitation renvoyée");
      refresh();
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Erreur");
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm">Membres de l'organisation</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {users.data?.rows.length ?? 0} utilisateur{(users.data?.rows.length ?? 0) !== 1 ? "s" : ""}
              </p>
            </div>
            <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1.5">
              <UserPlus className="w-3.5 h-3.5" />
              Ajouter un utilisateur
            </Button>
          </div>
          {/* Filters */}
          <div className="flex flex-wrap gap-2 pt-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Rechercher nom, email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[150px] h-8 text-sm">
                <SelectValue placeholder="Tous les rôles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les rôles</SelectItem>
                {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] h-8 text-sm">
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="actif">Actif</SelectItem>
                <SelectItem value="invite">Invitation envoyée</SelectItem>
                <SelectItem value="inactif">Inactif</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {users.isLoading ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Utilisateur</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="whitespace-nowrap">Dernière connexion</TableHead>
                    <TableHead className="whitespace-nowrap">Rejoint le</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                        {search || roleFilter !== "all" || statusFilter !== "all"
                          ? "Aucun résultat pour ces filtres"
                          : "Aucun membre dans cette organisation"}
                      </TableCell>
                    </TableRow>
                  ) : rows.map((u) => {
                    const status = getUserStatus(u);
                    const StatusIcon = status.icon;
                    const isLoading = (key: string) => actionLoading === `${key}-${u.userId}`;
                    return (
                      <TableRow key={u.userId}>
                        {/* Nom */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-primary">{initials(u)}</span>
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">
                                {[u.firstName, u.lastName].filter(Boolean).join(" ") || "—"}
                              </div>
                              {u.isPrimary && (
                                <span className="text-[10px] text-muted-foreground">Principal</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        {/* Email */}
                        <TableCell className="text-sm text-muted-foreground">
                          <span className="flex items-center gap-1 min-w-0">
                            <Mail className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-[180px]">{u.email ?? "—"}</span>
                          </span>
                        </TableCell>
                        {/* Téléphone */}
                        <TableCell className="text-sm text-muted-foreground">
                          {u.phone ? (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 shrink-0" />
                              {u.phone}
                            </span>
                          ) : "—"}
                        </TableCell>
                        {/* Rôle */}
                        <TableCell>
                          <span className="text-xs bg-muted px-2 py-0.5 rounded">
                            {ROLE_LABELS[u.role] ?? u.role}
                          </span>
                        </TableCell>
                        {/* Statut */}
                        <TableCell>
                          <Badge variant="outline" className={`${status.cls} text-xs gap-1`}>
                            <StatusIcon className="w-3 h-3" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        {/* Dernière connexion */}
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {fmtDateTime(u.lastLoginAt)}
                        </TableCell>
                        {/* Rejoint le */}
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {fmtDate(u.joinedAt)}
                        </TableCell>
                        {/* Actions */}
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                <MoreVertical className="w-3.5 h-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem onClick={() => openEdit(u)}>
                                <RefreshCw className="w-3.5 h-3.5 mr-2" />
                                Modifier les informations
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {u.isActive ? (
                                <DropdownMenuItem
                                  className="text-red-600"
                                  disabled={isLoading("deactivate")}
                                  onClick={() => setConfirmAction({ user: u, action: "deactivate" })}
                                >
                                  {isLoading("deactivate")
                                    ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                                    : <UserX className="w-3.5 h-3.5 mr-2" />}
                                  Désactiver le compte
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  className="text-emerald-700"
                                  disabled={isLoading("activate")}
                                  onClick={() => setConfirmAction({ user: u, action: "activate" })}
                                >
                                  {isLoading("activate")
                                    ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                                    : <UserCheck className="w-3.5 h-3.5 mr-2" />}
                                  Réactiver le compte
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                disabled={isLoading("invite")}
                                onClick={() => handleResendInvite(u)}
                              >
                                {isLoading("invite")
                                  ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                                  : <Send className="w-3.5 h-3.5 mr-2" />}
                                Renvoyer l'invitation
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                disabled={isLoading("reset")}
                                onClick={() => handleResetPassword(u)}
                              >
                                {isLoading("reset")
                                  ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                                  : <KeyRound className="w-3.5 h-3.5 mr-2" />}
                                Réinitialiser le mot de passe
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Add User Dialog ─────────────────────────────────────────────── */}
      <Dialog open={showAdd} onOpenChange={(o) => { if (!o) setShowAdd(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Ajouter un utilisateur
            </DialogTitle>
            <DialogDescription>
              Créer un nouveau compte ou ajouter un utilisateur existant à <strong>{orgName}</strong>.
              Un email d'invitation sera envoyé automatiquement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Prénom *</Label>
                <Input
                  value={addForm.firstName}
                  onChange={(e) => setAddForm((f) => ({ ...f, firstName: e.target.value }))}
                  placeholder="Prénom"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nom *</Label>
                <Input
                  value={addForm.lastName}
                  onChange={(e) => setAddForm((f) => ({ ...f, lastName: e.target.value }))}
                  placeholder="Nom de famille"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email *</Label>
              <Input
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="email@exemple.com"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Téléphone</Label>
              <Input
                value={addForm.phone}
                onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+228 90 00 00 00"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Rôle dans l'organisation</Label>
              <Select value={addForm.role} onValueChange={(v) => setAddForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAdd(false)}>Annuler</Button>
            <Button onClick={handleAdd} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              Créer et inviter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit User Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!editUser} onOpenChange={(o) => { if (!o) setEditUser(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier l'utilisateur</DialogTitle>
            <DialogDescription>
              Modifier les informations de {editUser ? [editUser.firstName, editUser.lastName].filter(Boolean).join(" ") || editUser.email : ""}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Prénom</Label>
                <Input
                  value={editForm.firstName}
                  onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nom</Label>
                <Input
                  value={editForm.lastName}
                  onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Téléphone</Label>
              <Input
                value={editForm.phone}
                onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Rôle dans l'organisation</Label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditUser(null)}>Annuler</Button>
            <Button onClick={handleEdit} disabled={editSaving} className="gap-1.5">
              {editSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm Activate/Deactivate Dialog ──────────────────────────── */}
      <Dialog open={!!confirmAction} onOpenChange={(o) => { if (!o) setConfirmAction(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.action === "deactivate" ? "Désactiver le compte" : "Réactiver le compte"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction?.action === "deactivate"
                ? `Désactiver le compte de ${confirmAction.user.firstName ?? confirmAction.user.email} bloquera toutes ses sessions actives.`
                : `Réactiver le compte de ${confirmAction?.user.firstName ?? confirmAction?.user.email} lui permettra de se reconnecter.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Annuler</Button>
            <Button
              variant={confirmAction?.action === "deactivate" ? "destructive" : "default"}
              disabled={!!actionLoading}
              onClick={() => {
                if (!confirmAction) return;
                if (confirmAction.action === "deactivate") {
                  handleDeactivate(confirmAction.user);
                } else {
                  handleActivate(confirmAction.user);
                }
              }}
            >
              {actionLoading && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
              {confirmAction?.action === "deactivate" ? "Désactiver" : "Réactiver"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
