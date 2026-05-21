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
import { UserPlus, Mail, Copy, Pencil, Power, ShieldCheck, FolderKanban, Search } from "lucide-react";

type User = { id: string; email: string; firstName: string; lastName: string; role: string; phone?: string; isActive: boolean; departmentId?: string; mustChangePassword?: boolean; lastLoginAt?: string; invitedAt?: string; acceptedAt?: string };
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
                    <TableCell><Badge variant="outline" className="font-mono text-xs">{u.role}</Badge></TableCell>
                    <TableCell className="text-sm">{deptsData?.data?.find(d => d.id === u.departmentId)?.name ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {u.isActive ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 w-fit">Actif</Badge> : <Badge variant="secondary" className="w-fit">Désactivé</Badge>}
                        {u.mustChangePassword && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 w-fit text-[10px]">Doit changer MDP</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("fr-FR") : "Jamais"}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
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
    onSuccess: (r) => { setResult(r); onDone(); toast({ title: "Invitation envoyée" }); },
    onError: (e: any) => toast({ title: "Erreur", description: e?.body?.error, variant: "destructive" }),
  });

  if (result) {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Mail className="w-5 h-5 text-emerald-600" />Invitation créée</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground">Email</div>
              <div className="font-medium">{result.email}</div>
            </div>
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground">Lien d'activation (valable 7 jours)</div>
              <div className="font-mono text-xs break-all">{result.acceptUrl}</div>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => { navigator.clipboard.writeText(result.acceptUrl); toast({ title: "Lien copié" }); }}>
                <Copy className="w-3 h-3 mr-1" />Copier le lien
              </Button>
            </div>
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground">Mot de passe temporaire</div>
              <div className="font-mono text-base">{result.temporaryPassword}</div>
            </div>
            <div className="text-xs text-muted-foreground">
              Statut envoi : <Badge variant="outline">{result.delivery?.provider}</Badge>{" "}
              {result.delivery?.delivered ? "✓ envoyé" : "(échec d'envoi — copiez le lien manuellement)"}
            </div>
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
