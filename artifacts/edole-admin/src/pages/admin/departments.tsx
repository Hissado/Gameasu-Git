import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus, Pencil, Trash2 } from "lucide-react";

type Dept = { id: string; code: string; name: string; description?: string; color?: string; usersCount: number };

export default function AdminDepartmentsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ["admin/departments"],
    queryFn: () => apiFetch<{ data: Dept[] }>("/api/departments"),
  });
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Dept | null>(null);
  const [del, setDel] = useState<Dept | null>(null);

  const create = useMutation({
    mutationFn: (b: any) => apiFetch("/api/departments", { method: "POST", body: b }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin/departments"] }); toast({ title: "Département créé" }); setOpen(false); },
    onError: (e: any) => toast({ title: "Erreur", description: e?.body?.error, variant: "destructive" }),
  });
  const update = useMutation({
    mutationFn: (b: any) => apiFetch(`/api/departments/${b.id}`, { method: "PUT", body: b }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin/departments"] }); toast({ title: "Département mis à jour" }); setEdit(null); },
    onError: (e: any) => toast({ title: "Erreur", description: e?.body?.error, variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/departments/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin/departments"] }); toast({ title: "Département supprimé" }); setDel(null); },
    onError: (e: any) => toast({ title: "Erreur", description: e?.body?.error, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Départements</h1>
          <p className="text-muted-foreground mt-1">Pôles et unités organisationnelles</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-primary hover:bg-primary/90"><Plus className="w-4 h-4 mr-2" />Nouveau département</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Liste</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <div>Chargement…</div> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Département</TableHead><TableHead>Code</TableHead>
                <TableHead>Description</TableHead><TableHead>Utilisateurs</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(data?.data || []).map(d => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: d.color || "hsl(22 100% 50% / 0.13)" }}>
                          <Building2 className="w-4 h-4" style={{ color: d.color || "hsl(22 100% 50%)" }} />
                        </div>
                        <span className="font-medium">{d.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{d.code}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{d.description}</TableCell>
                    <TableCell><span className="text-sm">{d.usersCount}</span></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setEdit(d)}><Pencil className="w-3 h-3" /></Button>
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setDel(d)}><Trash2 className="w-3 h-3" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {(open || edit) && (
        <DeptDialog
          initial={edit ?? undefined}
          onClose={() => { setOpen(false); setEdit(null); }}
          onSubmit={(b) => edit ? update.mutate({ ...b, id: edit.id }) : create.mutate(b)}
          pending={create.isPending || update.isPending}
        />
      )}

      <ConfirmDialog
        open={!!del} onOpenChange={(o) => !o && setDel(null)}
        title={`Supprimer le département « ${del?.name} » ?`}
        description={<>Les utilisateurs rattachés ({del?.usersCount ?? 0}) seront détachés (non supprimés).</>}
        destructive requireTypeToConfirm={del?.code}
        onConfirm={() => { if (del) remove.mutate(del.id); }}
      />
    </div>
  );
}

function DeptDialog({ initial, onClose, onSubmit, pending }: { initial?: Partial<Dept>; onClose: () => void; onSubmit: (b: any) => void; pending: boolean }) {
  const [code, setCode] = useState(initial?.code || "");
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [color, setColor] = useState(initial?.color || "#FF6B00");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial ? "Modifier" : "Nouveau"} département</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Code</Label><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="OPE" /></div>
          <div><Label>Nom</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
          <div><Label>Couleur</Label><Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-20" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => onSubmit({ code, name, description, color })} disabled={pending || !code || !name}>{pending ? "…" : "Enregistrer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
