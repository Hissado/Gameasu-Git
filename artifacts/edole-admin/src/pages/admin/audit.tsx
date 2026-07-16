import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ClipboardList, Search, ChevronLeft, ChevronRight } from "lucide-react";

type Log = {
  id: string; userId?: string; userEmail?: string; action: string;
  entityType?: string; entityId?: string; payload?: any;
  ipAddress?: string; userAgent?: string; createdAt: string;
};

type AuditResponse = {
  data: Log[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-emerald-100 text-emerald-700",
  update: "bg-blue-100 text-blue-700",
  delete: "bg-red-100 text-red-700",
  login: "bg-muted text-foreground",
  login_failed: "bg-amber-100 text-amber-700",
  login_2fa_sent: "bg-muted text-muted-foreground",
  login_2fa_success: "bg-emerald-100 text-emerald-700",
  login_2fa_failed: "bg-red-100 text-red-700",
  invite: "bg-purple-100 text-purple-700",
  invitation_sent: "bg-purple-100 text-purple-700",
  invitation_resend: "bg-purple-100 text-purple-600",
  invitation_accept: "bg-emerald-100 text-emerald-700",
  invitation_revoke: "bg-red-100 text-red-700",
  role_change: "bg-amber-100 text-amber-800",
  permission_change: "bg-amber-100 text-amber-800",
  password_change: "bg-pink-100 text-pink-700",
  password_reset_request: "bg-pink-100 text-pink-700",
  password_reset_complete: "bg-pink-100 text-pink-700",
  kiosk_create: "bg-cyan-100 text-cyan-700",
  kiosk_delete: "bg-red-100 text-red-700",
  kiosk_token_generate: "bg-cyan-100 text-cyan-800",
  kiosk_token_revoke: "bg-orange-100 text-orange-700",
  kiosk_token_access: "bg-muted text-muted-foreground",
};

const ACTION_LABELS: Record<string, string> = {
  create: "Création",
  update: "Modification",
  delete: "Suppression",
  login: "Connexion",
  login_failed: "Connexion échouée",
  login_2fa_sent: "2FA envoyé",
  login_2fa_success: "2FA validé",
  login_2fa_failed: "2FA échoué",
  invite: "Invitation",
  invitation_sent: "Invitation envoyée",
  invitation_resend: "Invitation renvoyée",
  invitation_accept: "Invitation acceptée",
  invitation_revoke: "Invitation révoquée",
  role_change: "Changement de rôle",
  permission_change: "Modif. permissions",
  password_change: "Changement MDP",
  password_reset_request: "Réinit. MDP demandée",
  password_reset_complete: "MDP réinitialisé",
  kiosk_create: "Kiosk créé",
  kiosk_delete: "Kiosk supprimé",
  kiosk_token_generate: "Token régénéré",
  kiosk_token_revoke: "Token révoqué",
  kiosk_token_access: "Accès kiosk",
};

export default function AdminAuditPage() {
  const [action, setAction] = useState<string>("_all");
  const [entityType, setEntityType] = useState<string>("_all");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  if (action !== "_all") params.set("action", action);
  if (entityType !== "_all") params.set("entityType", entityType);
  if (q) params.set("q", q);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  params.set("page", String(page));
  params.set("limit", "25");

  const resetPage = () => setPage(1);

  const { data, isLoading } = useQuery<AuditResponse>({
    queryKey: ["admin/audit", action, entityType, q, from, to, page],
    queryFn: () => apiFetch<AuditResponse>(`/api/admin/audit?${params.toString()}`),
  });

  const logs = data?.data ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Journal d'audit</h1>
        <p className="text-muted-foreground mt-1">Traçabilité des actions sensibles</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); resetPage(); }} placeholder="Email utilisateur…" className="pl-9" />
        </div>
        <Select value={action} onValueChange={(v) => { setAction(v); resetPage(); }}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Action" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Toutes les actions</SelectItem>
            {Object.keys(ACTION_LABELS).map(a => <SelectItem key={a} value={a}>{ACTION_LABELS[a]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={entityType} onValueChange={(v) => { setEntityType(v); resetPage(); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Type d'entité" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Toutes les entités</SelectItem>
            <SelectItem value="user">Utilisateur</SelectItem>
            <SelectItem value="role">Rôle</SelectItem>
            <SelectItem value="department">Département</SelectItem>
            <SelectItem value="project">Projet</SelectItem>
            <SelectItem value="kiosk">Kiosque</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground shrink-0">Du</Label>
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); resetPage(); }} className="w-36 h-9 text-sm" />
          <Label className="text-xs text-muted-foreground shrink-0">au</Label>
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); resetPage(); }} className="w-36 h-9 text-sm" />
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              {total} évènement{total !== 1 ? "s" : ""}
            </CardTitle>
            {pages > 1 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span>Page {page} / {pages}</span>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && <div>Chargement…</div>}
          <div className="space-y-1.5">
            {logs.map(l => (
              <div key={l.id} className="flex items-start gap-3 border rounded-md p-2.5 hover:bg-muted/30">
                <div className="text-xs text-muted-foreground w-36 shrink-0 mt-0.5">{new Date(l.createdAt).toLocaleString("fr-FR")}</div>
                <Badge className={`shrink-0 ${ACTION_COLORS[l.action] || "bg-muted"}`}>{ACTION_LABELS[l.action] ?? l.action}</Badge>
                <div className="flex-1 min-w-0 text-sm">
                  <div>
                    <span className="font-medium">{l.userEmail || "(système)"}</span>
                    {l.entityType && <span className="text-muted-foreground"> · {l.entityType}{l.entityId ? ` #${l.entityId.slice(0, 8)}` : ""}</span>}
                  </div>
                  {l.payload && (
                    <details className="text-xs text-muted-foreground">
                      <summary className="cursor-pointer">Détails</summary>
                      <pre className="bg-muted/40 rounded p-2 mt-1 overflow-x-auto max-h-40">{JSON.stringify(l.payload, null, 2)}</pre>
                    </details>
                  )}
                </div>
                {l.ipAddress && <div className="text-xs text-muted-foreground font-mono">{l.ipAddress}</div>}
              </div>
            ))}
            {!isLoading && logs.length === 0 && (
              <div className="text-center text-muted-foreground py-8">Aucun évènement.</div>
            )}
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-4 border-t mt-4">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Précédent
              </Button>
              <span className="text-sm text-muted-foreground">Page {page} sur {pages}</span>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>
                Suivant <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
