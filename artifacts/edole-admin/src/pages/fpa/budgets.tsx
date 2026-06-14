import { useEffect, useState } from "react";
import { Link } from "wouter";
import { apiFetch, ApiError } from "@/lib/api";
import { formatFCFA } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Copy, CheckCircle2, Trash2, Archive, FileSpreadsheet } from "lucide-react";
import { toast as baseToast } from "@/hooks/use-toast";

const toast = {
  success: (msg: string) => baseToast({ title: msg }),
  error: (msg: string) => baseToast({ title: msg, variant: "destructive" }),
};

interface FiscalPeriod { id: string; name: string; startDate: string; endDate: string; }
interface BudgetRow {
  id: string; name: string; kind: string; scope: string; scopeId: string | null;
  versionNumber: number; status: string; fiscalPeriodId: string;
  fiscalPeriodName?: string; creatorName?: string | null; totalAmount: number;
  notes?: string | null; projectIds?: string[] | null;
}
interface Project { id: string; name: string; }
interface Department { id: string; name: string; }
interface Service { id: string; name: string; }

const SCOPE_LABELS: Record<string, string> = {
  company: "Entreprise", project: "Projet", department: "Département",
  service: "Service", activity: "Activité",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Brouillon", color: "bg-gray-100 text-gray-700" },
  active: { label: "Actif", color: "bg-emerald-100 text-emerald-700" },
  archived: { label: "Archivé", color: "bg-slate-100 text-slate-600" },
};

export default function BudgetsListPage() {
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [periodId, setPeriodId] = useState<string>("");
  const [scope, setScope] = useState<string>("all");
  const [kind, setKind] = useState<string>("all");
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<{ data: FiscalPeriod[] }>("/api/accounting/fiscal-periods").then((r) => {
      setPeriods(r.data);
      const open = r.data[0];
      if (open) setPeriodId(open.id);
    }).catch(() => {});
    apiFetch<{ data: Project[] }>("/api/projects").then((r) => setProjects(r.data || []));
    apiFetch<{ data: Department[] }>("/api/hr/departments").then((r) => setDepartments(r.data || []));
    apiFetch<{ data: Service[] }>("/api/services").then((r) => setServices(r.data || []));
  }, []);

  function load() {
    if (!periodId) return;
    setLoading(true);
    const params = new URLSearchParams({ fiscalPeriodId: periodId });
    if (scope !== "all") params.set("scope", scope);
    if (kind !== "all") params.set("kind", kind);
    apiFetch<{ data: BudgetRow[] }>(`/api/fpa/budgets?${params}`)
      .then((r) => setBudgets(r.data))
      .finally(() => setLoading(false));
  }
  useEffect(load, [periodId, scope, kind]);

  function scopeName(b: BudgetRow): string {
    if (b.scope === "company") return "Entreprise";
    if (b.scope === "project") return projects.find((p) => p.id === b.scopeId)?.name || "(projet)";
    if (b.scope === "department") return departments.find((d) => d.id === b.scopeId)?.name || "(dépt)";
    if (b.scope === "service") return services.find((s) => s.id === b.scopeId)?.name || "(service)";
    return SCOPE_LABELS[b.scope] || b.scope;
  }

  async function activate(id: string) {
    try {
      await apiFetch(`/api/fpa/budgets/${id}/activate`, { method: "POST" });
      toast.success("Version activée");
      load();
    } catch (e: any) { toast.error(e.message || "Erreur"); }
  }
  async function duplicate(b: BudgetRow) {
    try {
      const created = await apiFetch<any>(`/api/fpa/budgets/${b.id}/duplicate`, {
        method: "POST",
        body: { name: `${b.name} (copie)` },
      });
      toast.success(`Version v${created.versionNumber} créée`);
      load();
    } catch (e: any) { toast.error(e.message || "Erreur"); }
  }
  async function archive(id: string) {
    try {
      await apiFetch(`/api/fpa/budgets/${id}`, { method: "PUT", body: { status: "archived" } });
      toast.success("Archivé");
      load();
    } catch (e: any) { toast.error(e.message || "Erreur"); }
  }
  async function remove(id: string) {
    if (!confirm("Supprimer définitivement ce budget ?")) return;
    try {
      await apiFetch(`/api/fpa/budgets/${id}`, { method: "DELETE" });
      toast.success("Supprimé");
      load();
    } catch (e: any) { toast.error(e.message || "Erreur"); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Budget</h1>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Nouveau budget</Button></DialogTrigger>
          <CreateBudgetDialog
            periods={periods} projects={projects} departments={departments} services={services}
            onCreated={() => { setCreateOpen(false); load(); }}
          />
        </Dialog>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Période</Label>
            <Select value={periodId} onValueChange={setPeriodId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {periods.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Périmètre</Label>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="company">Entreprise</SelectItem>
                <SelectItem value="project">Projet</SelectItem>
                <SelectItem value="department">Département</SelectItem>
                <SelectItem value="service">Service</SelectItem>
                <SelectItem value="activity">Activité</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Type</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="budget">Budget</SelectItem>
                <SelectItem value="forecast">Prévision</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading && <div className="p-6 text-sm text-muted-foreground">Chargement…</div>}
        {!loading && budgets.length === 0 && (
          <div className="p-12 text-center text-muted-foreground">
            <p>Aucun budget pour ces filtres.</p>
            <Button className="mt-4" onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-2" />Créer le premier</Button>
          </div>
        )}
        {!loading && budgets.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Nom</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Périmètre</th>
                  <th className="px-4 py-3">Version</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {budgets.map((b) => (
                  <tr key={b.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link href={`/fpa/budgets/${b.id}`} className="font-medium text-primary hover:underline">
                        {b.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{b.creatorName}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={b.kind === "forecast" ? "outline" : "secondary"}>
                        {b.kind === "forecast" ? "Prévision" : "Budget"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{SCOPE_LABELS[b.scope]}</span>
                      {b.scope !== "company" && <span className="block text-xs text-muted-foreground">{scopeName(b)}</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">v{b.versionNumber}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_LABELS[b.status]?.color || ""}`}>
                        {STATUS_LABELS[b.status]?.label || b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{formatFCFA(b.totalAmount)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/fpa/budgets/${b.id}`}>
                          <Button size="sm" variant="ghost" title="Éditer"><Edit className="w-4 h-4" /></Button>
                        </Link>
                        <Button size="sm" variant="ghost" title="Dupliquer" onClick={() => duplicate(b)}>
                          <Copy className="w-4 h-4" />
                        </Button>
                        {b.status !== "active" && (
                          <Button size="sm" variant="ghost" title="Activer" onClick={() => activate(b.id)}>
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          </Button>
                        )}
                        {b.status === "active" && (
                          <Button size="sm" variant="ghost" title="Archiver" onClick={() => archive(b.id)}>
                            <Archive className="w-4 h-4" />
                          </Button>
                        )}
                        <a href={`/api/fpa/export/budget/${b.id}.xlsx?token=${encodeURIComponent(localStorage.getItem("auth_token") || "")}`}
                          download title="Exporter Excel">
                          <Button size="sm" variant="ghost"><FileSpreadsheet className="w-4 h-4" /></Button>
                        </a>
                        {b.status !== "active" && (
                          <Button size="sm" variant="ghost" title="Supprimer" onClick={() => remove(b.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function CreateBudgetDialog({ periods, projects, departments, services, onCreated }: {
  periods: FiscalPeriod[]; projects: Project[]; departments: Department[]; services: Service[];
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState("budget");
  const [periodId, setPeriodId] = useState("");
  const [scope, setScope] = useState("company");
  const [scopeId, setScopeId] = useState<string>("");
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (periods[0] && !periodId) setPeriodId(periods[0].id); }, [periods]);
  useEffect(() => { setScopeId(""); setProjectIds([]); }, [scope]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !periodId) { toast.error("Nom et période requis"); return; }
    if (scope !== "company" && !scopeId) { toast.error("Sélectionnez l'élément du périmètre"); return; }
    setSubmitting(true);
    try {
      await apiFetch("/api/fpa/budgets", {
        method: "POST",
        body: {
          name, kind, fiscalPeriodId: periodId, scope,
          scopeId: scope === "company" ? null : scopeId,
          projectIds: scope === "project" && scopeId ? [scopeId] : projectIds,
          notes,
        },
      });
      toast.success("Budget créé");
      onCreated();
    } catch (e: any) {
      toast.error(e instanceof ApiError ? e.message : "Erreur");
    } finally { setSubmitting(false); }
  }

  return (
    <DialogContent className="max-w-xl">
      <DialogHeader><DialogTitle>Nouveau budget</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label>Nom</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Budget annuel 2026" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Type</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="budget">Budget</SelectItem>
                <SelectItem value="forecast">Prévision</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Période fiscale</Label>
            <Select value={periodId} onValueChange={setPeriodId}>
              <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
              <SelectContent>{periods.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Périmètre</Label>
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="company">Entreprise (global)</SelectItem>
              <SelectItem value="project">Projet</SelectItem>
              <SelectItem value="department">Département</SelectItem>
              <SelectItem value="service">Service</SelectItem>
              <SelectItem value="activity">Activité</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {scope === "project" && (
          <div>
            <Label>Projet</Label>
            <Select value={scopeId} onValueChange={setScopeId}>
              <SelectTrigger><SelectValue placeholder="Choisir un projet…" /></SelectTrigger>
              <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        {scope === "department" && (
          <>
            <div>
              <Label>Département</Label>
              <Select value={scopeId} onValueChange={setScopeId}>
                <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Projets contributeurs (pour les actuels)</Label>
              <div className="border rounded p-2 max-h-40 overflow-y-auto space-y-1">
                {projects.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={projectIds.includes(p.id)}
                      onChange={(e) => setProjectIds(e.target.checked ? [...projectIds, p.id] : projectIds.filter((x) => x !== p.id))}
                    /> {p.name}
                  </label>
                ))}
              </div>
            </div>
          </>
        )}
        {scope === "service" && (
          <div>
            <Label>Service</Label>
            <Select value={scopeId} onValueChange={setScopeId}>
              <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
              <SelectContent>{services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        {scope === "activity" && (
          <div>
            <Label>Activité (rattachée à un projet)</Label>
            <Select value={scopeId} onValueChange={setScopeId}>
              <SelectTrigger><SelectValue placeholder="Choisir un projet support de l'activité…" /></SelectTrigger>
              <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Une activité est rattachée à un projet pour le suivi des actuels.</p>
          </div>
        )}
        <div>
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={submitting}>{submitting ? "Création…" : "Créer"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
