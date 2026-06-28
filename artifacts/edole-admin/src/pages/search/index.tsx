/**
 * Phase 12 — Recherche universelle Gameasu.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Building, FolderKanban, CheckSquare, TrendingUp, FileText, Users, File } from "lucide-react";

const ICONS: Record<string, any> = {
  building: Building, folder: FolderKanban, "check-square": CheckSquare,
  "trending-up": TrendingUp, "file-text": FileText, users: Users, file: File,
};

type Result = { id: string; title: string; subtitle?: string; url: string; score: number };
type Group = { key: string; label: string; icon: string; results: Result[] };
type SearchResponse = { q: string; total: number; groups: Group[] };

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export default function UniversalSearchPage() {
  const [q, setQ] = useState("");
  const [, setLocation] = useLocation();
  const debouncedQ = useDebounced(q, 250);

  const search = useQuery<SearchResponse>({
    queryKey: ["universal-search", debouncedQ],
    queryFn: () => apiFetch(`/api/search?q=${encodeURIComponent(debouncedQ)}`),
    enabled: debouncedQ.length >= 2,
  });

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-1">Recherche universelle</p>
        <h1 className="text-3xl font-bold tracking-tight">Tout retrouver d'un coup</h1>
        <p className="text-muted-foreground mt-1">Clients, projets, tâches, opportunités, factures, équipe, documents.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          autoFocus value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Tapez au moins 2 caractères…"
          className="pl-10 h-12 text-base"
        />
      </div>

      {debouncedQ.length < 2 && (
        <p className="text-sm text-muted-foreground italic">Saisissez au moins 2 caractères pour rechercher.</p>
      )}

      {search.isLoading && debouncedQ.length >= 2 && (
        <div className="py-8 text-center"><Loader2 className="w-5 h-5 mx-auto animate-spin text-muted-foreground" /></div>
      )}

      {search.data && search.data.total === 0 && (
        <p className="text-sm text-muted-foreground italic">Aucun résultat pour « {search.data.q} ».</p>
      )}

      {search.data && search.data.total > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{search.data.total} résultat(s) dans {search.data.groups.length} catégorie(s)</p>
          {search.data.groups.map((g) => {
            const Icon = ICONS[g.icon] ?? File;
            return (
              <Card key={g.key}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-sm">{g.label}</h3>
                    <Badge variant="secondary" className="text-[10px]">{g.results.length}</Badge>
                  </div>
                  <div className="space-y-1">
                    {g.results.map((r) => (
                      <button key={r.id}
                        onClick={() => setLocation(r.url)}
                        className="w-full text-left flex items-center justify-between gap-2 px-2 py-2 rounded hover:bg-muted/60 transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{r.title}</p>
                          {r.subtitle && <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>}
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">S{r.score}</Badge>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
