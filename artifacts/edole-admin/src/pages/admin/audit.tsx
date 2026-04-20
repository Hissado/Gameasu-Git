import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Search } from "lucide-react";

type Log = {
  id: string; userId?: string; userEmail?: string; action: string;
  entityType?: string; entityId?: string; payload?: any;
  ipAddress?: string; userAgent?: string; createdAt: string;
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-emerald-100 text-emerald-700",
  update: "bg-blue-100 text-blue-700",
  delete: "bg-red-100 text-red-700",
  login: "bg-slate-100 text-slate-700",
  login_failed: "bg-orange-100 text-orange-700",
  invite: "bg-purple-100 text-purple-700",
  role_change: "bg-amber-100 text-amber-800",
  permission_change: "bg-amber-100 text-amber-800",
  password_change: "bg-pink-100 text-pink-700",
  password_reset_request: "bg-pink-100 text-pink-700",
  password_reset_complete: "bg-pink-100 text-pink-700",
};

export default function AdminAuditPage() {
  const [action, setAction] = useState<string>("_all");
  const [entityType, setEntityType] = useState<string>("_all");
  const [q, setQ] = useState("");

  const params = new URLSearchParams();
  if (action !== "_all") params.set("action", action);
  if (entityType !== "_all") params.set("entityType", entityType);
  if (q) params.set("q", q);

  const { data, isLoading } = useQuery({
    queryKey: ["admin/audit", action, entityType, q],
    queryFn: () => apiFetch<{ data: Log[] }>(`/api/admin/audit?${params.toString()}`),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Journal d'audit</h1>
        <p className="text-muted-foreground mt-1">Trace des actions sensibles effectuées sur la plateforme.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Email utilisateur…" className="pl-9" />
        </div>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Action" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Toutes les actions</SelectItem>
            {Object.keys(ACTION_COLORS).map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={entityType} onValueChange={setEntityType}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Type d'entité" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Toutes les entités</SelectItem>
            <SelectItem value="user">Utilisateur</SelectItem>
            <SelectItem value="role">Rôle</SelectItem>
            <SelectItem value="department">Département</SelectItem>
            <SelectItem value="project">Projet</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="w-5 h-5 text-primary" />{(data?.data || []).length} évènements</CardTitle></CardHeader>
        <CardContent>
          {isLoading && <div>Chargement…</div>}
          <div className="space-y-1.5">
            {(data?.data || []).map(l => (
              <div key={l.id} className="flex items-start gap-3 border rounded-md p-2.5 hover:bg-muted/30">
                <div className="text-xs text-muted-foreground w-36 shrink-0 mt-0.5">{new Date(l.createdAt).toLocaleString("fr-FR")}</div>
                <Badge className={`shrink-0 ${ACTION_COLORS[l.action] || "bg-slate-100"}`}>{l.action}</Badge>
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
            {!isLoading && (data?.data || []).length === 0 && (
              <div className="text-center text-muted-foreground py-8">Aucun évènement.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
