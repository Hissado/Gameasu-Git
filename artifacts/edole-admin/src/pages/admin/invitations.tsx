import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MailCheck, Send, Copy, Inbox } from "lucide-react";

type Inv = { id: string; email: string; firstName: string; lastName: string; role: string; invitedAt?: string; acceptedAt?: string; expiresAt?: string; isActive: boolean };
type Preview = { to: string; subject: string; sentAt: string; result: { provider: string; delivered: boolean } };

export default function AdminInvitationsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ["admin/invitations"],
    queryFn: () => apiFetch<{ data: Inv[]; preview: Preview[] }>("/api/admin/invitations"),
  });
  const resend = useMutation({
    mutationFn: (id: string) => apiFetch<any>(`/api/admin/users/${id}/resend-invitation`, { method: "POST" }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["admin/invitations"] });
      toast({ title: "Nouvelle invitation envoyée", description: `Lien copié dans le presse-papier.` });
      navigator.clipboard.writeText(r.acceptUrl);
    },
    onError: (e: any) => toast({ title: "Erreur", description: e?.body?.error, variant: "destructive" }),
  });

  const status = (i: Inv) => {
    if (i.acceptedAt) return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Acceptée</Badge>;
    if (!i.isActive) return <Badge variant="secondary">Désactivée</Badge>;
    if (i.expiresAt && new Date(i.expiresAt) < new Date()) return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Expirée</Badge>;
    return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">En attente</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Invitations</h1>
        <p className="text-muted-foreground mt-1">Invitations envoyées</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><MailCheck className="w-5 h-5 text-primary" />Invitations</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <div>Chargement…</div> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Personne</TableHead><TableHead>Rôle</TableHead><TableHead>Envoyée le</TableHead>
                <TableHead>Statut</TableHead><TableHead>Expire</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(data?.data || []).map(i => (
                  <TableRow key={i.id}>
                    <TableCell>
                      <div className="font-medium">{i.firstName} {i.lastName}</div>
                      <div className="text-xs text-muted-foreground">{i.email}</div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="font-mono text-xs">{i.role}</Badge></TableCell>
                    <TableCell className="text-xs">{i.invitedAt ? new Date(i.invitedAt).toLocaleString("fr-FR") : "—"}</TableCell>
                    <TableCell>{status(i)}</TableCell>
                    <TableCell className="text-xs">{i.expiresAt ? new Date(i.expiresAt).toLocaleString("fr-FR") : "—"}</TableCell>
                    <TableCell className="text-right">
                      {!i.acceptedAt && (
                        <Button size="sm" variant="outline" onClick={() => resend.mutate(i.id)} disabled={resend.isPending}>
                          <Send className="w-3 h-3 mr-1" />Relancer
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(data?.data || []).length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucune invitation envoyée pour le moment.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {(data?.preview || []).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Inbox className="w-5 h-5" />Boîte d'aperçu (dev)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(data?.preview || []).map((p, i) => (
                <div key={i} className="flex items-center justify-between border rounded-md p-2 text-sm">
                  <div>
                    <div className="font-medium">{p.subject}</div>
                    <div className="text-xs text-muted-foreground">À : {p.to} · {new Date(p.sentAt).toLocaleString("fr-FR")}</div>
                  </div>
                  <Badge variant="outline">{p.result.provider}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
