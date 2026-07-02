import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { HrShell } from "./_layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Search, User, Calendar, ArrowRightLeft, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useLocation } from "wouter";

type AuditLog = {
  id: string;
  organizationId: string;
  performedById: string | null;
  performedByName: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName: string | null;
  fieldChanged: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
};

const ACTION_LABELS: Record<string, string> = {
  salary_update: "Modification salaire",
  department_change: "Changement département",
  position_change: "Changement de poste",
  status_change: "Changement de statut",
  deletion: "Suppression",
};

const ACTION_COLORS: Record<string, string> = {
  salary_update: "bg-amber-100 text-amber-800",
  department_change: "bg-blue-100 text-blue-800",
  position_change: "bg-indigo-100 text-indigo-800",
  status_change: "bg-violet-100 text-violet-800",
  deletion: "bg-red-100 text-red-800",
};

const FIELD_LABELS: Record<string, string> = {
  baseSalary: "Salaire de base",
  departmentId: "Département",
  positionId: "Poste",
  employmentStatus: "Statut emploi",
  deletedAt: "Suppression",
};

const PAGE_SIZE = 25;

export default function HrAuditLogPage() {
  const [location] = useLocation();
  const params = new URLSearchParams(location.split("?")[1] ?? "");
  const [search, setSearch] = useState(params.get("entityId") ?? "");
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState(params.get("entityId") ?? "");
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery<{ data: AuditLog[]; total: number }>({
    queryKey: ["hr-audit-logs", actionFilter, entityFilter, page],
    queryFn: () => {
      const q = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
      if (actionFilter && actionFilter !== "all") q.set("action", actionFilter);
      if (entityFilter) q.set("entityId", entityFilter);
      return apiFetch<{ data: AuditLog[]; total: number }>(`/api/hr/audit-logs?${q}`);
    },
  });

  const logs = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleSearch = () => { setEntityFilter(search.trim()); setPage(0); };

  return (
    <HrShell
      title="Journal d'audit RH"
      subtitle="Historique des modifications sensibles : salaires, postes, suppressions"
      actions={
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>{total} entrée{total > 1 ? "s" : ""}</span>
        </div>
      }
    >
      {/* Filters */}
      <Card className="shadow-sm">
        <CardContent className="p-3 flex flex-wrap gap-3 items-end">
          <div className="flex items-center gap-1 flex-1 min-w-[200px]">
            <Input
              placeholder="ID collaborateur…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              className="h-8 text-xs"
            />
            <Button size="sm" variant="outline" className="h-8 px-2" onClick={handleSearch}>
              <Search className="w-3.5 h-3.5" />
            </Button>
          </div>
          <Select value={actionFilter} onValueChange={v => { setActionFilter(v); setPage(0); }}>
            <SelectTrigger className="h-8 text-xs w-48"><SelectValue placeholder="Tous les types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              {Object.entries(ACTION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          {(entityFilter || actionFilter !== "all") && (
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setEntityFilter(""); setSearch(""); setActionFilter("all"); setPage(0); }}>
              Réinitialiser
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Log list */}
      <Card className="shadow-sm">
        <CardHeader className="py-3 border-b">
          <CardTitle className="text-sm font-semibold">Entrées récentes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Chargement…</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <ShieldCheck className="w-10 h-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Aucune entrée d'audit pour ce filtre.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {logs.map(log => (
                <div key={log.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${ACTION_COLORS[log.action] ?? "bg-slate-100 text-slate-700"}`}>
                          {ACTION_LABELS[log.action] ?? log.action}
                        </span>
                        {log.entityName && (
                          <span className="text-xs font-medium text-foreground truncate">{log.entityName}</span>
                        )}
                      </div>
                      {log.fieldChanged && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <ArrowRightLeft className="w-3 h-3 shrink-0 text-slate-400" />
                          <span className="font-medium text-foreground/70">{FIELD_LABELS[log.fieldChanged] ?? log.fieldChanged} :</span>
                          <span className="line-through text-red-500/70">{log.oldValue ?? "—"}</span>
                          <span>→</span>
                          <span className="text-emerald-600">{log.newValue ?? "—"}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0 space-y-0.5">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground justify-end">
                        <User className="w-3 h-3" />
                        <span>{log.performedByName || "Système"}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground justify-end">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(log.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{total} entrée{total > 1 ? "s" : ""} — page {page + 1} / {totalPages}</span>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setPage(p => p - 1)} disabled={page === 0}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </HrShell>
  );
}
