import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Mail, Copy, Pencil, Power, ShieldCheck, FolderKanban, Search, Eye, X, Plus, Trash2, AlertCircle, Lock } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

type User = { id: string; email: string; firstName: string; lastName: string; role: string; phone?: string; isActive: boolean; departmentId?: string; mustChangePassword?: boolean; lastLoginAt?: string; invitedAt?: string; acceptedAt?: string };

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super-admin",
  admin: "Administrateur",
  manager: "Manager",
  commercial: "Commercial",
  collaborator: "Collaborateur",
};
type Role = { id: string; code: string; name: string };
type Dept = { id: string; name: string; code: string };
type Project = { id: string; name: string };

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: usersData, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch<{ data: User[]; total: number }>("/api/users?limit=200"),
  });
  const { data: rolesData } = useQuery({
    queryKey: ["admin/roles"],
    queryFn: () => apiFetch<{ data: Role[] }>("/api/admin/roles"),
  });
  const { data: deptsData } = useQuery({
    queryKey: ["admin/departments"],
    queryFn: () => apiFetch<{ data: Dept[] }>("/api/departments"),
  });

  const [inviteOpen, setInviteOpen] = useState(false);
  const [edit, setEdit] = useState<User | null>(null);
  const [accessUser, setAccessUser] = useState<User | null>(null);
  const [effectiveUser, setEffectiveUser] = useState<User | null>(null);
  const [confirm, setConfirm] = useState<{ user: User; action: "deactivate" | "activate" } | null>(null);
  const [search, setSearch] = useState("");

  const filtered = (usersData?.data || []).filter(u =>
    !search || `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase()),
  );

  const update = useMutation({
    mutationFn: (b: any) => apiFetch(`/api/users/${b.id}`, { method: "PUT", body: b }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast({ title: "Utilisateur mis à jour" }); setEdit(null); },
    onError: (e: any) => toast({ title: "Erreur", description: e?.body?.error, variant: "destructive" }),
  });
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => apiFetch(`/api/users/${id}`, { method: "PUT", body: { isActive: active } as any }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast({ title: "Statut mis à jour" }); setConfirm(null); },
    onError: (e: any) => toast({ title: "Erreur", description: e?.body?.error, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Utilisateurs</h1>
          <p className="text-muted-foreground mt-1">Invitations · Rôles · Accès projets</p>
        </div>
        <Button onClick={() => setInviteOpen(true)} className="bg-primary hover:bg-primary/90"><UserPlus className="w-4 h-4 mr-2" />Inviter</Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par nom ou email…" className="pl-9" />
      </div>

      <Card>
        <CardHeader><CardTitle>Annuaire ({filtered.length})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0 sm:p-6">
          {isLoading ? <div>Chargement…</div> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Utilisateur</TableHead><TableHead>Rôle</TableHead>
                <TableHead>Département</TableHead><TableHead>Statut</TableHead>
                <TableHead>Dernière connexion</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map(u => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-9 h-9"><AvatarFallback className="bg-primary/10 text-primary font-semibold">{u.firstName?.[0]}{u.lastName?.[0]}</AvatarFallback></Avatar>
                        <div>
                          <div className="font-medium">{u.firstName} {u.lastName}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{ROLE_LABELS[u.role] ?? u.role}</Badge></TableCell>
                    <TableCell className="text-sm">{deptsData?.data?.find(d => d.id === u.departmentId)?.name ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {u.isActive ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 w-fit">Actif</Badge> : <Badge variant="secondary" className="w-fit">Désactivé</Badge>}
                        {u.mustChangePassword && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 w-fit text-[10px]">Doit changer MDP</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("fr-FR") : "Jamais"}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" title="Accès effectifs" onClick={() => setEffectiveUser(u)}><Eye className="w-3.5 h-3.5 text-primary" /></Button>
                      <Button size="sm" variant="ghost" title="Modifier" onClick={() => setEdit(u)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button size="sm" variant="ghost" title="Accès projets" onClick={() => setAccessUser(u)}><FolderKanban className="w-3.5 h-3.5" /></Button>
                      <Button size="sm" variant="ghost" title={u.isActive ? "Désactiver" : "Activer"} onClick={() => setConfirm({ user: u, action: u.isActive ? "deactivate" : "activate" })}>
                        <Power className={`w-3.5 h-3.5 ${u.isActive ? "text-red-500" : "text-emerald-600"}`} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {inviteOpen && (
        <InviteDialog
          roles={rolesData?.data || []}
          departments={deptsData?.data || []}
          onClose={() => setInviteOpen(false)}
          onDone={() => qc.invalidateQueries({ queryKey: ["users"] })}
        />
      )}

      {edit && (
        <EditUserDialog
          user={edit}
          roles={rolesData?.data || []}
          departments={deptsData?.data || []}
          onClose={() => setEdit(null)}
          onSubmit={(b) => update.mutate(b)}
          pending={update.isPending}
        />
      )}

      {accessUser && (
        <ProjectAccessDialog user={accessUser} onClose={() => setAccessUser(null)} />
      )}

      {effectiveUser && (
        <UserAccessDialog user={effectiveUser} onClose={() => setEffectiveUser(null)} />
      )}

      <ConfirmDialog
        open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.action === "deactivate" ? `Désactiver ${confirm?.user?.firstName} ?` : `Réactiver ${confirm?.user?.firstName} ?`}
        description={confirm?.action === "deactivate" ? "L'utilisateur ne pourra plus se connecter. Vous pourrez le réactiver à tout moment." : "L'utilisateur pourra à nouveau se connecter."}
        destructive={confirm?.action === "deactivate"}
        confirmLabel={confirm?.action === "deactivate" ? "Désactiver" : "Réactiver"}
        onConfirm={() => { if (confirm) toggle.mutate({ id: confirm.user.id, active: confirm.action === "activate" }); }}
      />
    </div>
  );
}

function InviteDialog({ roles, departments, onClose, onDone }: { roles: Role[]; departments: Dept[]; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const { data: projects } = useQuery({ queryKey: ["projects/list"], queryFn: () => apiFetch<{ data: Project[] }>("/api/projects?limit=500") });
  const [email, setEmail] = useState("");
  const [firstName, setFirst] = useState("");
  const [lastName, setLast] = useState("");
  const [role, setRole] = useState("collaborator");
  const [departmentId, setDepartmentId] = useState<string | "">("");
  const [projectIds, setProjectIds] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<any>(null);

  const send = useMutation({
    mutationFn: () => apiFetch<any>("/api/admin/users/invite", { method: "POST", body: {
      email, firstName, lastName, role,
      departmentId: departmentId || undefined,
      projectIds: Array.from(projectIds),
    } as any }),
    onSuccess: (r) => {
      onDone();
      const isExisting = (r as any).method === "existing_user_added_to_org";
      toast({ title: isExisting ? "Utilisateur ajouté à l'organisation" : "Invitation envoyée" });
      if (isExisting) { onClose(); return; }
      setResult(r);
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.body?.error, variant: "destructive" }),
  });

  if (result) {
    const isExistingUser = (result as any).method === "existing_user_added_to_org";
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-emerald-600" />
              {isExistingUser ? "Utilisateur ajouté" : "Invitation créée"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground">Email</div>
              <div className="font-medium">{result.email}</div>
            </div>
            {isExistingUser ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-800 text-sm">
                Cet utilisateur possède déjà un compte Gameasu. Il a été ajouté à votre organisation et recevra une notification par email. Lors de sa prochaine connexion, il pourra choisir l'espace de travail à ouvrir.
              </div>
            ) : (
              <>
                <div className="rounded-md border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">Lien d'activation (valable 30 jours)</div>
                  <div className="font-mono text-xs break-all">{result.acceptUrl}</div>
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => { navigator.clipboard.writeText(result.acceptUrl!); toast({ title: "Lien copié" }); }}>
                    <Copy className="w-3 h-3 mr-1" />Copier le lien
                  </Button>
                </div>
                <div className="rounded-md border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">Mot de passe temporaire</div>
                  <div className="font-mono text-base">{result.temporaryPassword}</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Statut envoi :{" "}
                  {(result as any).delivery?.delivered ? "✓ envoyé" : "Échec d'envoi — copiez le lien manuellement"}
                </div>
              </>
            )}
          </div>
          <DialogFooter><Button onClick={onClose}>Fermer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Inviter un utilisateur</DialogTitle>
          <DialogDescription>Un email avec un lien d'activation et un mot de passe temporaire sera envoyé.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Prénom</Label><Input value={firstName} onChange={(e) => setFirst(e.target.value)} /></div>
            <div><Label>Nom</Label><Input value={lastName} onChange={(e) => setLast(e.target.value)} /></div>
          </div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Rôle</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{roles.map(r => <SelectItem key={r.id} value={r.code}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Département</Label>
              <Select value={departmentId || "_none"} onValueChange={(v) => setDepartmentId(v === "_none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Aucun</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {projects?.data && projects.data.length > 0 && (
            <div>
              <Label>Accès projets initiaux</Label>
              <div className="border rounded-md max-h-40 overflow-y-auto p-2 space-y-1">
                {projects.data.map(p => (
                  <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/30 p-1 rounded">
                    <Checkbox checked={projectIds.has(p.id)} onCheckedChange={() => {
                      const n = new Set(projectIds); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); setProjectIds(n);
                    }} />
                    <span>{p.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => send.mutate()} disabled={send.isPending || !email || !firstName || !lastName}>
            {send.isPending ? "Envoi…" : "Envoyer l'invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ user, roles, departments, onClose, onSubmit, pending }: { user: User; roles: Role[]; departments: Dept[]; onClose: () => void; onSubmit: (b: any) => void; pending: boolean }) {
  const [firstName, setFirst] = useState(user.firstName);
  const [lastName, setLast] = useState(user.lastName);
  const [role, setRole] = useState(user.role);
  const [phone, setPhone] = useState(user.phone || "");
  const [departmentId, setDept] = useState(user.departmentId || "");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Modifier l'utilisateur</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Prénom</Label><Input value={firstName} onChange={(e) => setFirst(e.target.value)} /></div>
            <div><Label>Nom</Label><Input value={lastName} onChange={(e) => setLast(e.target.value)} /></div>
          </div>
          <div><Label>Email</Label><Input value={user.email} disabled /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Rôle</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{roles.map(r => <SelectItem key={r.id} value={r.code}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Département</Label>
              <Select value={departmentId || "_none"} onValueChange={(v) => setDept(v === "_none" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Aucun</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Téléphone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => onSubmit({ id: user.id, firstName, lastName, role, phone, isActive: user.isActive, departmentId: departmentId || null })} disabled={pending}>
            {pending ? "…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProjectAccessDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: projects } = useQuery({ queryKey: ["projects/list"], queryFn: () => apiFetch<{ data: Project[] }>("/api/projects?limit=500") });
  const { data: current } = useQuery({
    queryKey: ["admin/users/access", user.id],
    queryFn: () => apiFetch<{ data: Array<{ projectId: string; accessLevel: string }> }>(`/api/admin/users/${user.id}/project-access`),
  });
  const [items, setItems] = useState<Map<string, string>>(new Map());
  React.useEffect(() => {
    if (current?.data) setItems(new Map(current.data.map(d => [d.projectId, d.accessLevel])));
  }, [current]);

  const save = useMutation({
    mutationFn: () => apiFetch(`/api/admin/users/${user.id}/project-access`, { method: "PUT", body: {
      items: Array.from(items.entries()).map(([projectId, accessLevel]) => ({ projectId, accessLevel })),
    } as any }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin/users/access", user.id] }); toast({ title: "Accès mis à jour" }); onClose(); },
    onError: (e: any) => toast({ title: "Erreur", description: e?.body?.error, variant: "destructive" }),
  });

  const setLevel = (pid: string, lvl: string | null) => {
    const n = new Map(items);
    if (!lvl) n.delete(pid); else n.set(pid, lvl);
    setItems(n);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FolderKanban className="w-5 h-5 text-primary" />Accès projets — {user.firstName} {user.lastName}</DialogTitle>
          <DialogDescription>Définissez les projets auxquels cet utilisateur a accès et son niveau.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-2">
          {(projects?.data || []).map(p => {
            const lvl = items.get(p.id);
            return (
              <div key={p.id} className="flex items-center justify-between gap-3 p-2 rounded-md hover:bg-muted/30">
                <div className="flex items-center gap-2 min-w-0">
                  <Checkbox checked={!!lvl} onCheckedChange={(c) => setLevel(p.id, c ? "viewer" : null)} />
                  <span className="truncate text-sm">{p.name}</span>
                </div>
                <Select value={lvl || "_none"} onValueChange={(v) => setLevel(p.id, v === "_none" ? null : v)}>
                  <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Aucun</SelectItem>
                    <SelectItem value="viewer">Lecture</SelectItem>
                    <SelectItem value="editor">Édition</SelectItem>
                    <SelectItem value="manager">Responsable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            );
          })}
          {(projects?.data || []).length === 0 && <div className="text-center text-muted-foreground py-8">Aucun projet disponible.</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "…" : `Enregistrer (${items.size} projets)`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type PermOverride = {
  id: string; userId: string; permissionCode: string;
  type: "grant" | "deny"; expiresAt: string | null; reason: string | null;
  grantedBy: string | null; createdAt: string;
};
type EffectivePermsData = {
  user: { id: string; email: string; firstName: string; lastName: string; role: string; isActive: boolean };
  role: { id: string; code: string; name: string } | null;
  isFullAccess: boolean;
  permissions: string[];
  permissionDetails: { code: string; label: string; category: string }[];
  projectAccess: { projectId: string; accessLevel: string; projectName?: string | null }[];
  overrides: PermOverride[];
};
type PermCatalogItem = { id: string; code: string; label: string; category: string };

function UserAccessDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<"view" | "manage">("view");
  const [showAddForm, setShowAddForm] = useState(false);
  const [addType, setAddType] = useState<"grant" | "deny">("grant");
  const [addCode, setAddCode] = useState("");
  const [addReason, setAddReason] = useState("");
  const [addExpires, setAddExpires] = useState("");
  const [codeSearch, setCodeSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin/users/effective-permissions", user.id],
    queryFn: () => apiFetch<EffectivePermsData>(`/api/admin/users/${user.id}/effective-permissions`),
  });

  const { data: catalogData } = useQuery({
    queryKey: ["admin/permissions"],
    queryFn: () => apiFetch<{ data: PermCatalogItem[] }>("/api/admin/permissions"),
    staleTime: 60_000,
  });
  const catalog = catalogData?.data ?? [];

  const addMutation = useMutation({
    mutationFn: (body: { permissionCode: string; type: string; reason: string; expiresAt: string | null }) =>
      apiFetch(`/api/admin/users/${user.id}/permission-overrides`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin/users/effective-permissions", user.id] });
      setShowAddForm(false); setAddCode(""); setAddReason(""); setAddExpires(""); setCodeSearch("");
      toast({ title: "Accès personnalisé enregistré" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: e?.message ?? "Erreur" }),
  });

  const removeMutation = useMutation({
    mutationFn: (overrideId: string) =>
      apiFetch(`/api/admin/users/${user.id}/permission-overrides/${overrideId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin/users/effective-permissions", user.id] });
      toast({ title: "Surcharge supprimée" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: e?.message ?? "Erreur" }),
  });

  const grouped = React.useMemo(() => {
    if (!data?.permissionDetails) return {} as Record<string, { code: string; label: string }[]>;
    return data.permissionDetails.reduce<Record<string, { code: string; label: string }[]>>((acc, p) => {
      (acc[p.category] ||= []).push(p); return acc;
    }, {});
  }, [data]);

  const grantOverrides = data?.overrides?.filter((o) => o.type === "grant") ?? [];
  const denyOverrides = data?.overrides?.filter((o) => o.type === "deny") ?? [];

  const filteredCatalog = React.useMemo(() => {
    if (!codeSearch.trim()) return catalog.slice(0, 40);
    const q = codeSearch.toLowerCase();
    return catalog.filter((p) => p.code.includes(q) || p.label.toLowerCase().includes(q)).slice(0, 40);
  }, [catalog, codeSearch]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col gap-0 p-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-base mb-0.5">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Accès — {user.firstName} {user.lastName}
          </DialogTitle>
          <div className="text-sm text-muted-foreground">{user.email} · <span className="font-mono text-xs">{ROLE_LABELS[user.role] ?? user.role}</span>
            {(data?.overrides?.length ?? 0) > 0 && (
              <Badge className="ml-2 bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px]">
                {data!.overrides.length} surcharge{data!.overrides.length > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          {/* Tabs */}
          <div className="flex gap-1 mt-3">
            <button onClick={() => setTab("view")} className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${tab === "view" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
              Permissions effectives
            </button>
            <button onClick={() => setTab("manage")} className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${tab === "manage" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
              Personnaliser
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Chargement…</div>
          ) : !data ? null : tab === "view" ? (
            <div className="space-y-4">
              {/* Résumé */}
              <div className="rounded-lg border p-3 flex items-center gap-3">
                <ShieldCheck className={`w-5 h-5 shrink-0 ${data.isFullAccess ? "text-emerald-600" : "text-primary"}`} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">
                    {data.isFullAccess ? "Accès complet — Super Admin / Admin" : `${data.permissions.length} permission(s) effective(s)`}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Rôle : {data.role?.name ?? "Aucun"}
                    {grantOverrides.length > 0 && ` · +${grantOverrides.length} accordée(s) manuellement`}
                    {denyOverrides.length > 0 && ` · −${denyOverrides.length} retirée(s)`}
                  </div>
                </div>
                {data.isFullAccess && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 shrink-0">Accès total</Badge>}
              </div>

              {!data.isFullAccess && (
                <div className="space-y-2">
                  <div className="text-sm font-semibold">Permissions par module</div>
                  {Object.keys(grouped).length === 0 ? (
                    <div className="text-sm text-muted-foreground italic">Aucune permission assignée.</div>
                  ) : Object.entries(grouped).map(([cat, perms]) => {
                    const grantedCodes = new Set(grantOverrides.map((o) => o.permissionCode));
                    const deniedCodes = new Set(denyOverrides.map((o) => o.permissionCode));
                    return (
                      <div key={cat} className="border rounded-lg overflow-hidden">
                        <div className="bg-muted/40 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">{cat}</div>
                        <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-0.5">
                          {perms.map((p) => {
                            const isGranted = grantedCodes.has(p.code);
                            const isDenied = deniedCodes.has(p.code);
                            return (
                              <div key={p.code} className={`flex items-start gap-1.5 text-xs p-1.5 rounded ${isDenied ? "opacity-40 line-through" : "hover:bg-muted/30"}`}>
                                <span className={`mt-0.5 ${isGranted ? "text-blue-500" : "text-emerald-500"}`}>{isDenied ? "✗" : isGranted ? "⊕" : "✓"}</span>
                                <div className="font-medium">{p.label}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {/* Grants qui ne sont pas dans le rôle */}
                  {grantOverrides.filter((o) => !data.permissionDetails.some((p) => p.code === o.permissionCode)).length > 0 && (
                    <div className="border border-blue-200 rounded-lg overflow-hidden">
                      <div className="bg-blue-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-blue-700">Accès supplémentaires personnalisés</div>
                      <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-0.5">
                        {grantOverrides.filter((o) => !data.permissionDetails.some((p) => p.code === o.permissionCode)).map((o) => (
                          <div key={o.id} className="flex items-start gap-1.5 text-xs p-1.5 rounded hover:bg-muted/30">
                            <span className="text-blue-500 mt-0.5">⊕</span>
                            <div><div className="font-medium">{o.permissionCode}</div>{o.reason && <div className="text-muted-foreground">{o.reason}</div>}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {data.projectAccess.length > 0 && (
                <div>
                  <div className="font-semibold text-sm mb-2">Accès projets directs ({data.projectAccess.length})</div>
                  <div className="border rounded-lg overflow-hidden">
                    {data.projectAccess.map((p) => (
                      <div key={p.projectId} className="flex items-center justify-between px-3 py-2 border-b last:border-b-0 hover:bg-muted/30">
                        <span className="text-sm truncate">{p.projectName ?? p.projectId}</span>
                        <Badge variant="outline" className="text-xs">{p.accessLevel === "viewer" ? "Lecture" : p.accessLevel === "editor" ? "Édition" : "Responsable"}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ── TAB PERSONNALISER ── */
            <div className="space-y-5">
              {data.isFullAccess && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Cet utilisateur est Admin / Super Admin. Les surcharges sont enregistrées mais n'ont pas d'effet tant que ce rôle est actif.
                </div>
              )}

              {/* GRANTS */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-sm flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-600" /> Permissions accordées en plus</div>
                  <span className="text-xs text-muted-foreground">{grantOverrides.length} règle{grantOverrides.length !== 1 ? "s" : ""}</span>
                </div>
                {grantOverrides.length === 0 ? (
                  <div className="text-sm text-muted-foreground italic border rounded-lg p-3">Aucune permission ajoutée manuellement.</div>
                ) : (
                  <div className="border rounded-lg overflow-hidden divide-y">
                    {grantOverrides.map((o) => (
                      <div key={o.id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-muted/30">
                        <span className="text-emerald-500 text-lg leading-none">⊕</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{o.permissionCode}</div>
                          {o.reason && <div className="text-xs text-muted-foreground truncate">{o.reason}</div>}
                          {o.expiresAt && <div className="text-xs text-amber-600">Expire le {new Date(o.expiresAt).toLocaleDateString("fr-FR")}</div>}
                        </div>
                        <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50 shrink-0" onClick={() => removeMutation.mutate(o.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* DENIES */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-sm flex items-center gap-1.5"><Lock className="w-4 h-4 text-red-500" /> Permissions retirées</div>
                  <span className="text-xs text-muted-foreground">{denyOverrides.length} règle{denyOverrides.length !== 1 ? "s" : ""}</span>
                </div>
                {denyOverrides.length === 0 ? (
                  <div className="text-sm text-muted-foreground italic border rounded-lg p-3">Aucune permission retirée manuellement.</div>
                ) : (
                  <div className="border rounded-lg overflow-hidden divide-y">
                    {denyOverrides.map((o) => (
                      <div key={o.id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-muted/30">
                        <span className="text-red-500 text-lg leading-none">⊘</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium line-through text-muted-foreground">{o.permissionCode}</div>
                          {o.reason && <div className="text-xs text-muted-foreground truncate">{o.reason}</div>}
                          {o.expiresAt && <div className="text-xs text-amber-600">Expire le {new Date(o.expiresAt).toLocaleDateString("fr-FR")}</div>}
                        </div>
                        <Button size="sm" variant="ghost" className="text-muted-foreground hover:bg-muted shrink-0" onClick={() => removeMutation.mutate(o.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* AJOUTER */}
              {!showAddForm ? (
                <Button variant="outline" className="w-full" onClick={() => setShowAddForm(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Ajouter une règle d'accès
                </Button>
              ) : (
                <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
                  <div className="font-semibold text-sm">Nouvelle règle</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs mb-1 block">Type</Label>
                      <Select value={addType} onValueChange={(v) => setAddType(v as "grant" | "deny")}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="grant">✓ Accorder</SelectItem>
                          <SelectItem value="deny">✗ Retirer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">Expiration (optionnelle)</Label>
                      <Input type="date" value={addExpires} onChange={(e) => setAddExpires(e.target.value)} min={new Date().toISOString().split("T")[0]} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Permission</Label>
                    <Input placeholder="Rechercher une permission…" value={codeSearch} onChange={(e) => { setCodeSearch(e.target.value); setAddCode(""); }} className="mb-1" />
                    {addCode && <div className="text-xs font-mono bg-primary/10 text-primary px-2 py-1 rounded mb-1">Sélection : {addCode}</div>}
                    <div className="border rounded max-h-40 overflow-y-auto divide-y">
                      {filteredCatalog.length === 0 ? (
                        <div className="p-2 text-xs text-muted-foreground text-center">Aucun résultat</div>
                      ) : filteredCatalog.map((p) => (
                        <button key={p.code} onClick={() => { setAddCode(p.code); setCodeSearch(p.label); }}
                          className={`w-full text-left px-2 py-1.5 text-xs hover:bg-muted/40 transition-colors ${addCode === p.code ? "bg-primary/10 font-semibold" : ""}`}>
                          <span className="font-medium">{p.label}</span>
                          <span className="text-muted-foreground ml-1 font-mono">{p.code}</span>
                          <span className="text-muted-foreground ml-1">· {p.category}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Raison / commentaire (optionnel)</Label>
                    <Textarea value={addReason} onChange={(e) => setAddReason(e.target.value)} rows={2} placeholder="Ex : Accès temporaire pour audit Q2 2025" />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => { setShowAddForm(false); setAddCode(""); setAddReason(""); setAddExpires(""); setCodeSearch(""); }}>Annuler</Button>
                    <Button size="sm" disabled={!addCode || addMutation.isPending} onClick={() => addMutation.mutate({ permissionCode: addCode, type: addType, reason: addReason, expiresAt: addExpires || null })}>
                      {addMutation.isPending ? "…" : "Enregistrer"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t">
          <Button className="w-full" variant="outline" onClick={onClose}>Fermer</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
