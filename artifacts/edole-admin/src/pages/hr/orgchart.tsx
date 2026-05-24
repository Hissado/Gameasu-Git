import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { HrShell } from "./_layout";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Search, ChevronDown, ChevronRight, Network } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type Department = {
  id: string; name: string; parentId: string | null;
  description: string | null; color: string | null;
};

type Collaborator = {
  id: string; firstName: string; lastName: string; jobTitle: string | null;
  departmentId: string | null; avatarUrl: string | null; status: string;
};

type OrgData = {
  departments: Department[];
  collaborators: Collaborator[];
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function initials(c: Collaborator) {
  return `${c.firstName[0] ?? ""}${c.lastName[0] ?? ""}`.toUpperCase();
}

const DEPT_COLORS = [
  "#F37021", "#C8A24B", "#0ea5e9", "#8b5cf6", "#10b981",
  "#f59e0b", "#ef4444", "#6366f1", "#14b8a6", "#ec4899",
];

// ── Carte collaborateur ────────────────────────────────────────────────────────

function CollabCard({ collab, highlight }: { collab: Collaborator; highlight: string }) {
  const fullName = `${collab.firstName} ${collab.lastName}`;
  const matches = highlight && fullName.toLowerCase().includes(highlight.toLowerCase());

  return (
    <div className={`flex items-center gap-2 p-2 rounded-lg border transition-all hover:shadow-sm ${matches ? "border-[#C8A24B] bg-amber-50/50" : "border-slate-100 bg-white hover:border-slate-200"}`}>
      <Avatar className="w-8 h-8 shrink-0">
        <AvatarImage src={collab.avatarUrl ?? undefined} />
        <AvatarFallback className="text-xs font-bold bg-slate-700 text-white">{initials(collab)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-900 truncate">{fullName}</p>
        <p className="text-xs text-slate-400 truncate">{collab.jobTitle ?? "—"}</p>
      </div>
    </div>
  );
}

// ── Carte département ─────────────────────────────────────────────────────────

function DepartmentNode({
  dept,
  members,
  color,
  search,
  level,
}: {
  dept: Department;
  members: Collaborator[];
  color: string;
  search: string;
  level: number;
}) {
  const [open, setOpen] = useState(true);

  const filtered = search
    ? members.filter(c => `${c.firstName} ${c.lastName} ${c.jobTitle ?? ""}`.toLowerCase().includes(search.toLowerCase()))
    : members;

  return (
    <div
      className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
      style={{ borderTopColor: color, borderTopWidth: 3 }}
    >
      {/* En-tête du département */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50/70 hover:bg-slate-100/70 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
          <span className="font-semibold text-sm text-slate-800">{dept.name}</span>
          <Badge variant="secondary" className="text-xs font-medium h-4 px-1.5">
            {members.length}
          </Badge>
        </div>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
      </button>

      {/* Grille des collaborateurs */}
      {open && (
        <div className="p-3">
          {filtered.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-3">
              {search ? "Aucun résultat" : "Aucun collaborateur actif"}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {filtered.map(c => (
                <CollabCard key={c.id} collab={c} highlight={search} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Collaborateurs sans département ───────────────────────────────────────────

function UndepartedSection({ collabs, search }: { collabs: Collaborator[]; search: string }) {
  const [open, setOpen] = useState(false);
  const filtered = search
    ? collabs.filter(c => `${c.firstName} ${c.lastName} ${c.jobTitle ?? ""}`.toLowerCase().includes(search.toLowerCase()))
    : collabs;

  if (collabs.length === 0 && !search) return null;

  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-100/50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-slate-300" />
          <span className="font-medium text-sm text-slate-500">Non affectés</span>
          <Badge variant="outline" className="text-xs h-4 px-1.5 text-slate-400">{collabs.length}</Badge>
        </div>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
      </button>
      {open && filtered.length > 0 && (
        <div className="p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {filtered.map(c => <CollabCard key={c.id} collab={c} highlight={search} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function HrOrgchart() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<OrgData>({
    queryKey: ["hr-orgchart"],
    queryFn: () => apiFetch("/api/hr/orgchart"),
  });

  const { deptMap, undeparted, total } = useMemo(() => {
    if (!data) return { deptMap: new Map<string, Collaborator[]>(), undeparted: [], total: 0 };
    const map = new Map<string, Collaborator[]>();
    const undeparted: Collaborator[] = [];
    for (const c of data.collaborators) {
      if (!c.departmentId) { undeparted.push(c); continue; }
      if (!map.has(c.departmentId)) map.set(c.departmentId, []);
      map.get(c.departmentId)!.push(c);
    }
    return { deptMap: map, undeparted, total: data.collaborators.length };
  }, [data]);

  const depts = data?.departments ?? [];

  return (
    <HrShell
      title="Organigramme"
      subtitle={`${total} collaborateurs actifs répartis en ${depts.length} département${depts.length !== 1 ? "s" : ""}`}
      actions={
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <Input
            placeholder="Rechercher un collaborateur…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      }
    >
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : depts.length === 0 && total === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Network className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="text-sm font-medium">Aucun département ni collaborateur actif</p>
          <p className="text-xs mt-1">Créez des départements et affectez vos collaborateurs pour visualiser l'organigramme.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Stats rapides */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-slate-200">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-slate-500">Total actifs</p>
                <p className="text-2xl font-bold text-slate-900 mt-0.5">{total}</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-slate-500">Départements</p>
                <p className="text-2xl font-bold text-slate-900 mt-0.5">{depts.length}</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-slate-500">Non affectés</p>
                <p className="text-2xl font-bold text-slate-900 mt-0.5">{undeparted.length}</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-slate-500">Taux affectation</p>
                <p className="text-2xl font-bold text-slate-900 mt-0.5">
                  {total > 0 ? Math.round(((total - undeparted.length) / total) * 100) : 0} %
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Grille des départements */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {depts.map((dept, idx) => (
              <DepartmentNode
                key={dept.id}
                dept={dept}
                members={deptMap.get(dept.id) ?? []}
                color={dept.color ?? DEPT_COLORS[idx % DEPT_COLORS.length]}
                search={search}
                level={0}
              />
            ))}
          </div>

          {/* Non affectés */}
          <UndepartedSection collabs={undeparted} search={search} />
        </div>
      )}
    </HrShell>
  );
}
