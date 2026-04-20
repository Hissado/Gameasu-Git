import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Plus, Settings2, Trash2, Lock, Users } from "lucide-react";

type Role = { id: string; code: string; name: string; description?: string; isSystem: boolean; level?: number; permissionsCount: number; usersCount: number };
type Perm = { id: string; code: string; label: string; category: string };

export default function AdminRolesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: rolesData, isLoading } = useQuery({
    queryKey: ["admin/roles"],
    queryFn: () => apiFetch<{ data: Role[] }>("/api/admin/roles"),
  });
  const { data: permsData } = useQuery({
    queryKey: ["admin/permissions"],
    queryFn: () => apiFetch<{ data: Perm[] }>("/api/admin/permissions"),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editPermsRoleId, setEditPermsRoleId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<Role | null>(null);

  const create = useMutation({
    mutationFn: (body: any) => apiFetch("/api/admin/roles", { method: "POST", body }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin/roles"] }); toast({ title: "Rôle créé" }); setCreateOpen(false); },
    onError: (e: any) => toast({ title: "Erreur", description: e?.body?.error, variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/roles/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin/roles"] }); toast({ title: "Rôle supprimé" }); setConfirmDel(null); },
    onError: (e: any) => toast({ title: "Suppression impossible", description: e?.body?.error, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rôles & permissions</h1>
          <p className="text-muted-foreground mt-1">Configurez précisément ce que chaque rôle peut faire.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" /> Nouveau rôle
        </Button>
      </div>

      {isLoading && <div className="text-muted-foreground">Chargement…</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rolesData?.data?.map((r) => (
          <Card key={r.id} className="hover:shadow-md transition">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    <CardTitle className="text-base">{r.name}</CardTitle>
                  </div>
                  <CardDescription className="mt-1 font-mono text-xs">{r.code}</CardDescription>
                </div>
                {r.isSystem && <Badge variant="outline" className="border-amber-300 text-amber-700"><Lock className="w-3 h-3 mr-1" />Système</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {r.description && <p className="text-sm text-muted-foreground">{r.description}</p>}
              <div className="flex items-center gap-3 text-xs">
                <Badge variant="secondary">{r.permissionsCount} permission{r.permissionsCount > 1 ? "s" : ""}</Badge>
                <span className="text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" />{r.usersCount} utilisateur{r.usersCount > 1 ? "s" : ""}</span>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => setEditPermsRoleId(r.id)}>
                  <Settings2 className="w-3 h-3 mr-1" /> Permissions
                </Button>
                {!r.isSystem && (
                  <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setConfirmDel(r)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Création */}
      <CreateRoleDialog open={createOpen} onOpenChange={setCreateOpen} onSubmit={(b) => create.mutate(b)} pending={create.isPending} />

      {/* Édition matrice */}
      {editPermsRoleId && (
        <EditPermissionsDialog
          roleId={editPermsRoleId}
          permissions={permsData?.data || []}
          onClose={() => setEditPermsRoleId(null)}
        />
      )}

      <ConfirmDialog
        open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}
        title={`Supprimer le rôle « ${confirmDel?.name} » ?`}
        description={confirmDel?.usersCount ? <>Ce rôle est attribué à <strong>{confirmDel.usersCount}</strong> utilisateur(s) — la suppression sera refusée.</> : "Cette action est irréversible."}
        destructive
        requireTypeToConfirm={confirmDel?.code}
        confirmLabel="Supprimer définitivement"
        onConfirm={() => confirmDel && remove.mutate(confirmDel.id)}
      />
    </div>
  );
}

function CreateRoleDialog({ open, onOpenChange, onSubmit, pending }: { open: boolean; onOpenChange: (o: boolean) => void; onSubmit: (b: any) => void; pending: boolean }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState(20);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Créer un rôle</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Code (technique)</Label><Input value={code} onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} placeholder="ex: chef_chantier" /></div>
          <div><Label>Nom</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Chef de chantier" /></div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
          <div><Label>Niveau hiérarchique (1-99)</Label><Input type="number" min={1} max={99} value={level} onChange={(e) => setLevel(Number(e.target.value))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={() => onSubmit({ code, name, description, level })} disabled={pending || !code || !name}>
            {pending ? "Création…" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditPermissionsDialog({ roleId, permissions, onClose }: { roleId: string; permissions: Perm[]; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ["admin/role", roleId],
    queryFn: () => apiFetch<any>(`/api/admin/roles/${roleId}`),
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  React.useEffect(() => {
    if (data?.permissionIds) setSelected(new Set(data.permissionIds));
  }, [data]);

  const save = useMutation({
    mutationFn: () => apiFetch(`/api/admin/roles/${roleId}/permissions`, { method: "PUT", body: { permissionIds: Array.from(selected) } as any }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin/roles"] }); qc.invalidateQueries({ queryKey: ["admin/role", roleId] }); toast({ title: "Permissions mises à jour" }); onClose(); },
    onError: (e: any) => toast({ title: "Erreur", description: e?.body?.error, variant: "destructive" }),
  });

  const grouped = useMemo(() => {
    return permissions.reduce<Record<string, Perm[]>>((acc, p) => { (acc[p.category] ||= []).push(p); return acc; }, {});
  }, [permissions]);

  const toggle = (id: string) => {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSelected(n);
  };
  const toggleCategory = (perms: Perm[]) => {
    const ids = perms.map(p => p.id);
    const allOn = ids.every(id => selected.has(id));
    const n = new Set(selected);
    if (allOn) ids.forEach(id => n.delete(id)); else ids.forEach(id => n.add(id));
    setSelected(n);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Permissions de « {data?.name} »</DialogTitle>
          {data?.isSystem && <Badge variant="outline" className="border-amber-300 text-amber-700 w-fit"><Lock className="w-3 h-3 mr-1" />Rôle système — modifications applicables aux non-admin uniquement</Badge>}
        </DialogHeader>
        {isLoading ? <div>Chargement…</div> : (
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {Object.entries(grouped).map(([cat, perms]) => {
              const ids = perms.map(p => p.id);
              const allOn = ids.every(id => selected.has(id));
              const someOn = !allOn && ids.some(id => selected.has(id));
              return (
                <div key={cat} className="border rounded-lg">
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b">
                    <div className="font-semibold text-sm">{cat}</div>
                    <button className="text-xs text-primary hover:underline" onClick={() => toggleCategory(perms)}>
                      {allOn ? "Tout désactiver" : someOn ? "Tout activer" : "Tout activer"}
                    </button>
                  </div>
                  <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {perms.map(p => (
                      <label key={p.id} className="flex items-start gap-2 text-sm cursor-pointer hover:bg-muted/30 p-1.5 rounded">
                        <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} className="mt-0.5" />
                        <div>
                          <div>{p.label}</div>
                          <div className="text-xs text-muted-foreground font-mono">{p.code}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Enregistrement…" : `Enregistrer (${selected.size} permissions)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
