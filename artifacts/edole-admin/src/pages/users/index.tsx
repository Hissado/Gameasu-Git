import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListUsers } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Send, MailCheck, RefreshCw, UserPlus, Ban, ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/format";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/lib/permissions";

const ROLE_OPTIONS = [
  { value: "admin",       label: "Administrateur" },
  { value: "manager",     label: "Responsable" },
  { value: "rh",          label: "Gestionnaire RH" },
  { value: "financier",   label: "Responsable Financier" },
  { value: "commercial",  label: "Commercial" },
  { value: "logistique",  label: "Gestionnaire Logistique" },
  { value: "comptable",   label: "Comptable" },
  { value: "auditeur",    label: "Auditeur (lecture seule)" },
  { value: "collaborator", label: "Collaborateur" },
] as const;

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super administrateur",
  admin: "Administrateur",
  manager: "Responsable",
  rh: "Gestionnaire RH",
  financier: "Responsable Financier",
  commercial: "Commercial",
  logistique: "Gestionnaire Logistique",
  auditeur: "Auditeur",
  technicien: "Technicien",
  comptable: "Comptable",
  client: "Client",
  collaborator: "Collaborateur",
};

type InvUser = {
  id: string; email: string; firstName: string; lastName: string;
  role: string; invitedAt?: string; acceptedAt?: string;
  expiresAt?: string; isActive: boolean;
};

type InvStatus = "accepted" | "revoked" | "expired" | "pending" | "no_link";

function getInvStatus(i: InvUser): InvStatus {
  if (i.acceptedAt) return "accepted";
  if (!i.isActive) return "revoked";
  if (i.expiresAt && new Date(i.expiresAt) < new Date()) return "expired";
  if (i.invitedAt) return "pending";
  return "no_link";
}

function InvStatusBadge({ status }: { status: InvStatus }) {
  switch (status) {
    case "accepted": return <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50">Acceptée</Badge>;
    case "revoked":  return <Badge className="bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-50">Révoquée</Badge>;
    case "expired":  return <Badge className="bg-red-50 text-red-700 border border-red-200 hover:bg-red-50">Expirée</Badge>;
    case "pending":  return <Badge className="bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-50">En attente</Badge>;
    default:         return <Badge variant="outline" className="text-muted-foreground">Sans lien</Badge>;
  }
}

export default function UsersList() {
  const qc = useQueryClient();
  const perms = usePermissions();
  const { data: usersData, isLoading } = useListUsers();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [invEmail, setInvEmail] = useState("");
  const [invFirst, setInvFirst] = useState("");
  const [invLast, setInvLast] = useState("");
  const [invRole, setInvRole] = useState("collaborator");
  const [invError, setInvError] = useState<string | null>(null);

  const { data: invData, refetch: refetchInv } = useQuery({
    queryKey: ["admin/invitations"],
    queryFn: () => apiFetch<{ data: InvUser[] }>("/api/admin/invitations"),
  });

  const inviteMut = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch<{ acceptUrl: string }>("/api/admin/users/invite", { method: "POST", body: body as any }),
    onSuccess: (r) => {
      setInviteOpen(false);
      setInvEmail(""); setInvFirst(""); setInvLast(""); setInvRole("collaborator"); setInvError(null);
      void qc.invalidateQueries({ queryKey: ["admin/invitations"] });
      void refetchInv();
      navigator.clipboard.writeText(r.acceptUrl).catch(() => {});
      toast.success("Invitation envoyée — lien copié dans le presse-papier.");
    },
    onError: (e: any) => setInvError(e?.body?.error ?? e?.message ?? "Erreur lors de l'invitation"),
  });

  const resendMut = useMutation({
    mutationFn: (userId: string) =>
      apiFetch<{ acceptUrl: string }>(`/api/admin/users/${userId}/resend-invitation`, { method: "POST" }),
    onSuccess: (r) => {
      void refetchInv();
      navigator.clipboard.writeText(r.acceptUrl).catch(() => {});
      toast.success("Invitation renvoyée — nouveau lien copié dans le presse-papier.");
    },
    onError: (e: any) => toast.error(e?.body?.error ?? e?.message ?? "Erreur lors de l'envoi"),
  });

  const revokeMut = useMutation({
    mutationFn: (userId: string) =>
      apiFetch<{ success: boolean }>(`/api/admin/users/${userId}/revoke-invitation`, { method: "POST" }),
    onSuccess: () => {
      void refetchInv();
      toast.success("Invitation révoquée — compte désactivé.");
    },
    onError: (e: any) => toast.error(e?.body?.error ?? e?.message ?? "Erreur lors de la révocation"),
  });

  const { user: currentUser } = useAuth();

  const changeRoleMut = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      apiFetch(`/api/users/${userId}`, { method: "PUT", body: { role } as any }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["listUsers"] });
      toast.success("Rôle mis à jour avec succès.");
    },
    onError: (e: any) => toast.error(e?.body?.error ?? e?.message ?? "Erreur lors de la mise à jour du rôle"),
  });

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setInvError(null);
    if (!invEmail || !invFirst || !invLast) { setInvError("Tous les champs marqués * sont requis."); return; }
    inviteMut.mutate({ email: invEmail.toLowerCase(), firstName: invFirst, lastName: invLast, role: invRole });
  };

  const pendingInv = (invData?.data ?? []).filter((i) => getInvStatus(i) !== "accepted");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Utilisateurs de la plateforme</h1>
          <p className="text-muted-foreground mt-1">Accès · Profils · Rôles internes</p>
        </div>
        {!perms.isReadOnly && (
          <Button onClick={() => setInviteOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <UserPlus className="w-4 h-4 mr-2" />
            Inviter un utilisateur
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Annuaire complet</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-24 hidden sm:block" />
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead className="hidden sm:table-cell">Rôle</TableHead>
                  <TableHead className="hidden md:table-cell">Profil</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="hidden sm:table-cell">Inscription</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersData?.data?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Aucun utilisateur enregistré.
                    </TableCell>
                  </TableRow>
                ) : (
                  usersData?.data?.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-9 h-9">
                            <AvatarImage src={user.avatarUrl ?? undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                              {user.firstName?.[0]}{user.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{user.firstName} {user.lastName}</div>
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {currentUser?.role === "admin" || currentUser?.role === "super_admin" ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="flex items-center gap-1 px-2 py-1 rounded-md border border-border/60 text-xs font-medium hover:bg-muted transition-colors">
                                {ROLE_LABEL[user.role] || user.role}
                                <ChevronDown className="w-3 h-3 text-muted-foreground ml-0.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-52">
                              {ROLE_OPTIONS.map((opt) => (
                                <DropdownMenuItem
                                  key={opt.value}
                                  onClick={() => {
                                    if (opt.value !== user.role && user.id !== currentUser?.id) {
                                      changeRoleMut.mutate({ userId: user.id, role: opt.value });
                                    }
                                  }}
                                  disabled={opt.value === user.role || user.id === currentUser?.id}
                                  className="text-sm"
                                >
                                  {opt.label}
                                  {opt.value === user.role && <span className="ml-auto text-primary text-xs">✓</span>}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <Badge variant="outline" className="font-medium">
                            {ROLE_LABEL[user.role] || user.role}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {user.isClient ? (
                          <Badge className="bg-blue-50 text-blue-700 border border-blue-200">Compte client</Badge>
                        ) : (
                          <Badge className="bg-amber-50 text-amber-700 border border-amber-200">Interne</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.isActive ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Actif</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted text-muted-foreground">Désactivé</Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {formatDate(user.createdAt ?? "")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {pendingInv.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MailCheck className="w-5 h-5 text-primary" />
              Invitations — Cycle de vie
              <Badge variant="outline" className="ml-1">{pendingInv.length}</Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Statuts : <span className="text-amber-700">En attente</span> · <span className="text-red-700">Expirée</span> · <span className="text-gray-500">Révoquée</span>
            </p>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Personne</TableHead>
                  <TableHead className="hidden sm:table-cell">Rôle</TableHead>
                  <TableHead className="hidden md:table-cell">Envoyée le</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="hidden md:table-cell">Expire</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInv.map((i) => {
                  const status = getInvStatus(i);
                  const canResend = status === "pending" || status === "expired" || status === "no_link";
                  const canRevoke = status === "pending" || status === "expired" || status === "no_link";
                  return (
                    <TableRow key={i.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{i.firstName} {i.lastName}</div>
                        <div className="text-xs text-muted-foreground">{i.email}</div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline" className="text-xs">{ROLE_LABEL[i.role] ?? i.role}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {i.invitedAt ? new Date(i.invitedAt).toLocaleDateString("fr-FR") : "—"}
                      </TableCell>
                      <TableCell><InvStatusBadge status={status} /></TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {i.expiresAt ? new Date(i.expiresAt).toLocaleDateString("fr-FR") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canResend && (
                            <Button
                              size="sm" variant="outline"
                              onClick={() => resendMut.mutate(i.id)}
                              disabled={resendMut.isPending}
                              className="text-xs h-7 px-2"
                            >
                              <RefreshCw className="w-3 h-3 mr-1" />Relancer
                            </Button>
                          )}
                          {canRevoke && (
                            <Button
                              size="sm" variant="outline"
                              onClick={() => revokeMut.mutate(i.id)}
                              disabled={revokeMut.isPending}
                              className="text-xs h-7 px-2 text-red-600 border-red-200 hover:bg-red-50"
                            >
                              <Ban className="w-3 h-3 mr-1" />Révoquer
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={inviteOpen} onOpenChange={(o) => { if (!o) { setInviteOpen(false); setInvError(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Inviter un utilisateur
            </DialogTitle>
            <DialogDescription>
              Un email avec un lien d'activation sécurisé sera envoyé à l'adresse indiquée.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInviteSubmit} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="inv-first">Prénom *</Label>
                <Input
                  id="inv-first" required value={invFirst}
                  onChange={(e) => setInvFirst(e.target.value)} placeholder="Kofi"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-last">Nom *</Label>
                <Input
                  id="inv-last" required value={invLast}
                  onChange={(e) => setInvLast(e.target.value)} placeholder="Asante"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-email">Adresse email *</Label>
              <Input
                id="inv-email" type="email" required value={invEmail}
                onChange={(e) => setInvEmail(e.target.value)} placeholder="kofi@entreprise.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-role">Rôle</Label>
              <Select value={invRole} onValueChange={setInvRole}>
                <SelectTrigger id="inv-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrateur</SelectItem>
                  <SelectItem value="manager">Responsable</SelectItem>
                  <SelectItem value="rh">Gestionnaire RH</SelectItem>
                  <SelectItem value="financier">Responsable Financier</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="logistique">Gestionnaire Logistique</SelectItem>
                  <SelectItem value="comptable">Comptable</SelectItem>
                  <SelectItem value="auditeur">Auditeur (lecture seule)</SelectItem>
                  <SelectItem value="collaborator">Collaborateur</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {invError && (
              <Alert variant="destructive">
                <AlertDescription>{invError}</AlertDescription>
              </Alert>
            )}
            <DialogFooter className="gap-2 mt-2">
              <Button type="button" variant="outline" onClick={() => { setInviteOpen(false); setInvError(null); }}>
                Annuler
              </Button>
              <Button type="submit" disabled={inviteMut.isPending} className="bg-primary hover:bg-primary/90">
                {inviteMut.isPending ? (
                  <><span className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />Envoi…</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" />Envoyer l'invitation</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
