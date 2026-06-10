import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { HrShell } from "./_layout";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Users, Search, ChevronDown, ChevronRight, Network, Share2, Building2 } from "lucide-react";

type Department = {
  id: string; name: string; parentId: string | null;
  description: string | null; color: string | null;
};

type Collaborator = {
  id: string; firstName: string; lastName: string; jobTitle: string | null;
  departmentId: string | null; avatarUrl: string | null; status: string;
  managerCollaboratorId: string | null;
};

type OrgData = {
  departments: Department[];
  collaborators: Collaborator[];
};

function initials(c: Collaborator) {
  return `${c.firstName[0] ?? ""}${c.lastName[0] ?? ""}`.toUpperCase();
}

const DEPT_COLORS = [
  "#F37021", "#C8A24B", "#0ea5e9", "#8b5cf6", "#10b981",
  "#f59e0b", "#ef4444", "#6366f1", "#14b8a6", "#ec4899",
];

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

function DepartmentNode({ dept, members, color, search }: { dept: Department; members: Collaborator[]; color: string; search: string }) {
  const [open, setOpen] = useState(true);
  const filtered = search
    ? members.filter(c => `${c.firstName} ${c.lastName} ${c.jobTitle ?? ""}`.toLowerCase().includes(search.toLowerCase()))
    : members;
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden" style={{ borderTopColor: color, borderTopWidth: 3 }}>
      <button className="w-full flex items-center justify-between px-4 py-3 bg-slate-50/70 hover:bg-slate-100/70 transition-colors" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
          <span className="font-semibold text-sm text-slate-800">{dept.name}</span>
          <Badge variant="secondary" className="text-xs font-medium h-4 px-1.5">{members.length}</Badge>
        </div>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
      </button>
      {open && (
        <div className="p-3">
          {filtered.length === 0
            ? <p className="text-xs text-slate-400 text-center py-3">{search ? "Aucun résultat" : "Aucun collaborateur actif"}</p>
            : <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">{filtered.map(c => <CollabCard key={c.id} collab={c} highlight={search} />)}</div>}
        </div>
      )}
    </div>
  );
}

function UndepartedSection({ collabs, search }: { collabs: Collaborator[]; search: string }) {
  const [open, setOpen] = useState(false);
  const filtered = search
    ? collabs.filter(c => `${c.firstName} ${c.lastName} ${c.jobTitle ?? ""}`.toLowerCase().includes(search.toLowerCase()))
    : collabs;
  if (collabs.length === 0 && !search) return null;
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 overflow-hidden">
      <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-100/50 transition-colors" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-slate-300" />
          <span className="font-medium text-sm text-slate-500">Non affectés à un département</span>
          <Badge variant="outline" className="text-xs h-4 px-1.5 text-slate-400">{collabs.length}</Badge>
        </div>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
      </button>
      {open && filtered.length > 0 && (
        <div className="p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">{filtered.map(c => <CollabCard key={c.id} collab={c} highlight={search} />)}</div>
        </div>
      )}
    </div>
  );
}

function ManagerTreeNode({ manager, children, allCollabs, search, depth }: {
  manager: Collaborator;
  children: Collaborator[];
  allCollabs: Collaborator[];
  search: string;
  depth: number;
}) {
  const [open, setOpen] = useState(depth < 2);
  const fullName = `${manager.firstName} ${manager.lastName}`;
  const matches = search && (fullName.toLowerCase().includes(search.toLowerCase()) || (manager.jobTitle ?? "").toLowerCase().includes(search.toLowerCase()));
  const grandChildren = (id: string) => allCollabs.filter(c => c.managerCollaboratorId === id);

  return (
    <div className={`${depth > 0 ? "ml-6 border-l-2 border-slate-200 pl-4" : ""}`}>
      <div className={`flex items-start gap-3 py-2 px-3 rounded-lg transition-colors ${matches ? "bg-amber-50 border border-amber-200" : "hover:bg-slate-50"}`}>
        <Avatar className="w-10 h-10 shrink-0 mt-0.5">
          <AvatarImage src={manager.avatarUrl ?? undefined} />
          <AvatarFallback className="text-xs font-bold bg-slate-700 text-white">{initials(manager)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">{fullName}</p>
          <p className="text-xs text-slate-500">{manager.jobTitle ?? "—"}</p>
          {children.length > 0 && (
            <button onClick={() => setOpen(!open)} className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline">
              {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {children.length} rapport{children.length > 1 ? "s" : ""} direct{children.length > 1 ? "s" : ""}
            </button>
          )}
        </div>
        {depth === 0 && <Badge variant="secondary" className="text-xs shrink-0">Direction</Badge>}
        {depth === 1 && <Badge variant="outline" className="text-xs shrink-0 border-primary/40 text-primary">Manager</Badge>}
      </div>

      {open && children.length > 0 && (
        <div className="mt-1 space-y-1">
          {children.map(child => (
            <ManagerTreeNode
              key={child.id}
              manager={child}
              children={grandChildren(child.id)}
              allCollabs={allCollabs}
              search={search}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

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

  const { roots, childrenMap, managersCount } = useMemo(() => {
    if (!data) return { roots: [], childrenMap: new Map<string, Collaborator[]>(), managersCount: 0 };
    const collabs = data.collaborators;
    const ids = new Set(collabs.map(c => c.id));
    const cmap = new Map<string, Collaborator[]>();
    for (const c of collabs) {
      const key = c.managerCollaboratorId && ids.has(c.managerCollaboratorId) ? c.managerCollaboratorId : null;
      if (key) {
        if (!cmap.has(key)) cmap.set(key, []);
        cmap.get(key)!.push(c);
      }
    }
    const rootNodes = collabs.filter(c => !c.managerCollaboratorId || !ids.has(c.managerCollaboratorId));
    const managersCount = collabs.filter(c => cmap.has(c.id)).length;
    return { roots: rootNodes, childrenMap: cmap, managersCount };
  }, [data]);

  const depts = data?.departments ?? [];

  return (
    <HrShell
      title="Organigramme"
      subtitle={`${total} collaborateurs actifs`}
      actions={
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <Input placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
        </div>
      }
    >
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total actifs", value: total, icon: Users },
              { label: "Départements", value: depts.length, icon: Building2 },
              { label: "Managers", value: managersCount, icon: Network },
              { label: "Taux affectation", value: `${total > 0 ? Math.round(((total - undeparted.length) / total) * 100) : 0}%`, icon: Share2 },
            ].map(({ label, value, icon: Icon }) => (
              <Card key={label} className="border-slate-200">
                <CardContent className="pt-4 pb-4 flex items-center gap-3">
                  <Icon className="w-5 h-5 text-slate-400 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="text-xl font-bold text-slate-900">{value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs defaultValue="departments">
            <TabsList>
              <TabsTrigger value="departments" className="gap-2"><Building2 className="w-4 h-4" />Par département</TabsTrigger>
              <TabsTrigger value="hierarchy" className="gap-2"><Network className="w-4 h-4" />Par hiérarchie</TabsTrigger>
            </TabsList>

            <TabsContent value="departments" className="mt-4">
              {depts.length === 0 && total === 0 ? (
                <div className="text-center py-20 text-slate-400">
                  <Network className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="text-sm font-medium">Aucun département ni collaborateur actif</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {depts.map((dept, idx) => (
                      <DepartmentNode
                        key={dept.id}
                        dept={dept}
                        members={deptMap.get(dept.id) ?? []}
                        color={dept.color ?? DEPT_COLORS[idx % DEPT_COLORS.length]}
                        search={search}
                      />
                    ))}
                  </div>
                  <UndepartedSection collabs={undeparted} search={search} />
                </div>
              )}
            </TabsContent>

            <TabsContent value="hierarchy" className="mt-4">
              {roots.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                  <Network className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="text-sm font-medium">Aucune hiérarchie définie</p>
                  <p className="text-xs mt-1">Assignez des managers aux collaborateurs dans leur fiche pour visualiser l'arbre.</p>
                </div>
              ) : (
                <Card>
                  <CardContent className="p-4 space-y-1">
                    {roots.map(root => (
                      <ManagerTreeNode
                        key={root.id}
                        manager={root}
                        children={childrenMap.get(root.id) ?? []}
                        allCollabs={data?.collaborators ?? []}
                        search={search}
                        depth={0}
                      />
                    ))}
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </HrShell>
  );
}
