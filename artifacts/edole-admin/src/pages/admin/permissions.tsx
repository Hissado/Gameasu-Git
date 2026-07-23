import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

type Perm = { id: string; code: string; label: string; category: string; description?: string };

export default function PermissionsCatalog() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin/permissions"],
    queryFn: () => apiFetch<{ data: Perm[] }>("/api/admin/permissions"),
  });
  const [q, setQ] = React.useState("");

  const filtered = (data?.data || []).filter(p =>
    !q || p.code.toLowerCase().includes(q.toLowerCase()) || p.label.toLowerCase().includes(q.toLowerCase()),
  );
  const grouped = filtered.reduce<Record<string, Perm[]>>((acc, p) => {
    (acc[p.category] ||= []).push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Catalogue de permissions</h1>
        <p className="text-muted-foreground mt-1">Référentiel des droits</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher par code ou libellé…" className="pl-9" />
      </div>

      {isLoading && <div className="text-muted-foreground">Chargement…</div>}

      {isError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">Le catalogue de permissions n'a pas pu être chargé.</p>
          <p className="text-muted-foreground mt-1">Vérifiez vos droits d'accès ou réessayez.</p>
          <button onClick={() => refetch()} className="mt-2 text-primary underline underline-offset-2">Réessayer</button>
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className="text-muted-foreground text-sm">
          {q ? <>Aucune permission ne correspond à « {q} ».</> : <>Le catalogue est vide — le seed RBAC n'a pas encore été exécuté sur cet environnement.</>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Object.entries(grouped).map(([cat, perms]) => (
          <Card key={cat}>
            <CardHeader><CardTitle className="text-base">{cat}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {perms.map(p => (
                <div key={p.id} className="flex items-start justify-between gap-3 py-1.5 border-b last:border-b-0">
                  <div>
                    <div className="font-medium text-sm">{p.label}</div>
                    {p.description && <div className="text-xs text-muted-foreground">{p.description}</div>}
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px] shrink-0">{p.code}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
