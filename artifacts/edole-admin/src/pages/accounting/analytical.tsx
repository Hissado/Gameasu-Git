import React, { useState, useMemo } from "react";
import { AccountingShell } from "./_layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { formatFCFA } from "@/lib/format";
import {
  BarChart3, Target, TrendingDown, TrendingUp, Plus, Pencil, Trash2,
  Building2, FolderKanban, Users, Activity, Tag, Layers, Globe, Settings2,
  AlertCircle, CheckCircle2, PieChart, BarChart2, ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  PieChart as RPieChart, Pie, Cell,
} from "recharts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CC_TYPES: Record<string, string> = {
  department: "Département", project: "Projet", activity: "Activité",
  service: "Service", geographic: "Zone géo.", product_line: "Ligne produit",
  direction: "Direction", agence: "Agence", equipe: "Équipe",
  uniteOp: "Unité opérationnelle", site: "Site",
};

const AXES: Record<string, { label: string; icon: React.ReactNode }> = {
  produit: { label: "Produit", icon: <Tag className="w-3.5 h-3.5" /> },
  service: { label: "Service", icon: <Settings2 className="w-3.5 h-3.5" /> },
  projet: { label: "Projet", icon: <FolderKanban className="w-3.5 h-3.5" /> },
  client: { label: "Client", icon: <Users className="w-3.5 h-3.5" /> },
  activite: { label: "Activité", icon: <Activity className="w-3.5 h-3.5" /> },
  departement: { label: "Département", icon: <Building2 className="w-3.5 h-3.5" /> },
  nature: { label: "Nature", icon: <Layers className="w-3.5 h-3.5" /> },
  site: { label: "Site / Agence", icon: <Globe className="w-3.5 h-3.5" /> },
  equipe: { label: "Équipe", icon: <Users className="w-3.5 h-3.5" /> },
};

const COST_TYPES = [
  { value: "direct",         label: "Direct" },
  { value: "indirect",       label: "Indirect" },
  { value: "variable",       label: "Variable" },
  { value: "fixe",           label: "Fixe" },
  { value: "investissement", label: "Investissement" },
  { value: "fonctionnement", label: "Fonctionnement" },
  { value: "operationnel",   label: "Opérationnel" },
  { value: "administratif",  label: "Administratif" },
  { value: "support",        label: "Support" },
];

const COLORS_PIE = ["#F37021","#1E3A5F","#10b981","#6366f1","#f59e0b","#ef4444","#0891b2","#7c3aed","#84cc16"];
const CC_COLORS = ["bg-blue-500","bg-orange-500","bg-emerald-500","bg-purple-500","bg-red-500","bg-cyan-500","bg-amber-500","bg-rose-500"];

function fmt(v: number) { return formatFCFA(v); }
function pctBadge(pct: number | null) {
  if (pct == null) return null;
  const color = pct > 100 ? "destructive" : pct > 80 ? "secondary" : "outline";
  return <Badge variant={color} className="text-xs">{pct}%</Badge>;
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KPI({ label, value, sub, icon: Icon, accent = "default" }: {
  label: string; value: string; sub?: string; icon: any;
  accent?: "success" | "danger" | "warning" | "default" | "info";
}) {
  const bg = { success: "bg-emerald-50", danger: "bg-red-50", warning: "bg-amber-50", info: "bg-blue-50", default: "bg-slate-50" }[accent];
  const ic = { success: "text-emerald-600", danger: "text-red-600", warning: "text-amber-600", info: "text-blue-600", default: "text-slate-600" }[accent];
  return (
    <Card className={`${bg} border-0`}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide font-semibold">{label}</p>
            <p className="text-xl font-bold truncate">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${ic} bg-white shadow-sm`}>
            <Icon className="w-4.5 h-4.5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// Onglet 1 — Tableau de bord
// ═══════════════════════════════════════════════════════════════
function DashboardTab({ from, to }: { from: string; to: string }) {
  const q = `${from ? `?from=${from}` : ""}${to ? `${from ? "&" : "?"}to=${to}` : ""}`;
  const { data, isLoading } = useQuery<any>({
    queryKey: ["cage-dashboard", from, to],
    queryFn: () => apiFetch(`/api/analytics/reports/dashboard${q}`),
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (!data) return null;

  const margePositive = data.margeNette >= 0;
  const pctMarge = data.totalProduits > 0 ? Math.round((data.margeNette / data.totalProduits) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Charges totales" value={fmt(data.totalCharges)} icon={TrendingDown} accent="danger"
          sub={`${data.nbImputations} imputation${data.nbImputations !== 1 ? "s" : ""}`} />
        <KPI label="Produits analytiques" value={fmt(data.totalProduits)} icon={TrendingUp} accent="success" />
        <KPI label="Marge nette" value={fmt(data.margeNette)} icon={margePositive ? ArrowUpRight : ArrowDownRight}
          accent={margePositive ? "success" : "danger"} sub={`${pctMarge}% du CA analytique`} />
        <KPI label="Centres de coût actifs" value={String(data.topCostCenters?.length ?? 0)} icon={Building2} accent="info" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tendance mensuelle */}
        {data.byMonth?.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2"><BarChart2 className="w-4 h-4 text-primary" />Tendance mensuelle</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.byMonth}>
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="charges" name="Charges" fill="#ef4444" radius={[3,3,0,0]} />
                  <Bar dataKey="produits" name="Produits" fill="#10b981" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Charges par type */}
        {data.byCostType?.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2"><PieChart className="w-4 h-4 text-primary" />Répartition par type de coût</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <RPieChart>
                  <Pie data={data.byCostType} dataKey="total" nameKey="costType" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {data.byCostType.map((_: any, i: number) => <Cell key={i} fill={COLORS_PIE[i % COLORS_PIE.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </RPieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-2 justify-center">
                {data.byCostType.map((r: any, i: number) => (
                  <div key={r.costType} className="flex items-center gap-1 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS_PIE[i % COLORS_PIE.length] }} />
                    {COST_TYPES.find(c => c.value === r.costType)?.label ?? r.costType}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Top centres de coût */}
      {data.topCostCenters?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" />Top centres de coût</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.topCostCenters.map((cc: any, i: number) => {
                const marge = cc.marge;
                return (
                  <div key={cc.id} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}</span>
                    <span className={`w-2 h-2 rounded-full ${CC_COLORS[i % CC_COLORS.length]}`} />
                    <span className="flex-1 text-sm font-medium truncate">{cc.name}</span>
                    <span className="text-sm text-muted-foreground">{fmt(cc.charges)}</span>
                    <Badge variant={marge >= 0 ? "outline" : "destructive"} className="text-xs min-w-0">
                      {marge >= 0 ? "+" : ""}{fmt(marge)}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {data.nbImputations === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
            <BarChart3 className="w-10 h-10 opacity-30" />
            <p className="text-sm font-medium">Aucune imputation analytique sur cette période</p>
            <p className="text-xs">Créez des imputations dans l'onglet <strong>Imputations</strong> pour alimenter le tableau de bord.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Onglet 2 — Centres de coût (enhanced)
// ═══════════════════════════════════════════════════════════════
type CostCenter = { id: string; code: string; name: string; type: string; color: string | null; budgetAmount: string | null; description: string | null; isActive: boolean; managerId: string | null; parentId: string | null };

function CostCentersTab({ from, to }: { from: string; to: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editCC, setEditCC] = useState<CostCenter | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", name: "", description: "", type: "department", budgetAmount: "" });

  const q = `${from ? `?from=${from}` : ""}${to ? `${from ? "&" : "?"}to=${to}` : ""}`;
  const { data: summary = [], isLoading } = useQuery<any[]>({
    queryKey: ["analytical-summary", from, to],
    queryFn: () => apiFetch(`/api/accounting/analytical/summary${q}`),
  });
  const { data: detail } = useQuery<any>({
    queryKey: ["cost-center-detail", detailId, from, to],
    queryFn: () => apiFetch(`/api/accounting/cost-centers/${detailId}?from=${from}&to=${to}`),
    enabled: !!detailId,
  });

  function openCreate() { setForm({ code: "", name: "", description: "", type: "department", budgetAmount: "" }); setEditCC(null); setOpen(true); }
  function openEdit(cc: any) {
    setForm({ code: cc.code, name: cc.name, description: cc.description ?? "", type: cc.type, budgetAmount: cc.budgetAmount ?? "" });
    setEditCC(cc); setOpen(true);
  }

  const saveMut = useMutation({
    mutationFn: (d: typeof form) => {
      const body = { ...d, budgetAmount: d.budgetAmount ? Number(d.budgetAmount) : undefined };
      if (editCC) return apiFetch(`/api/accounting/cost-centers/${editCC.id}`, { method: "PATCH", body: JSON.stringify(body) });
      return apiFetch("/api/accounting/cost-centers", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["analytical-summary"] }); setOpen(false); toast({ title: editCC ? "Centre mis à jour" : "Centre créé" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/accounting/cost-centers/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["analytical-summary"] }); toast({ title: "Centre supprimé" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const totalBudget = summary.reduce((s: number, c: any) => s + (c.budgetAmount ?? 0), 0);
  const totalConsumption = summary.reduce((s: number, c: any) => s + c.netConsumption, 0);
  const centersOverBudget = summary.filter((c: any) => c.budgetAmount && c.netConsumption > c.budgetAmount).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label="Centres" value={String(summary.length)} icon={Building2} />
        <KPI label="Budget total" value={fmt(totalBudget)} icon={Target} accent="info" />
        <KPI label="Consommé" value={fmt(totalConsumption)} icon={TrendingDown} accent="warning" />
        <KPI label="Dépassements" value={String(centersOverBudget)} icon={AlertCircle} accent={centersOverBudget > 0 ? "danger" : "default"} />
      </div>

      <div className="flex justify-end">
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1" />Nouveau centre</Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : summary.length === 0 ? (
        <Card className="border-dashed"><CardContent className="py-12 text-center text-sm text-muted-foreground">Aucun centre de coût. Créez-en un ci-dessus.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {summary.map((c: any, i: number) => {
            const over = c.budgetAmount && c.netConsumption > c.budgetAmount;
            return (
              <Card key={c.id} className={`transition-all ${detailId === c.id ? "ring-2 ring-primary" : "hover:shadow-sm"}`}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full shrink-0 ${CC_COLORS[i % CC_COLORS.length]}`} />
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setDetailId(detailId === c.id ? null : c.id)}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-muted-foreground">{c.code}</span>
                        <span className="font-semibold text-sm">{c.name}</span>
                        <Badge variant="outline" className="text-xs">{CC_TYPES[c.type] ?? c.type}</Badge>
                        {over && <Badge variant="destructive" className="text-xs">Dépassement</Badge>}
                      </div>
                      {c.budgetAmount != null && (
                        <div className="flex items-center gap-3 mt-1.5">
                          <Progress value={Math.min(c.usagePct ?? 0, 100)} className={`h-1.5 flex-1 ${over ? "[&>div]:bg-red-500" : ""}`} />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {fmt(c.netConsumption)} / {fmt(c.budgetAmount)}
                            <span className={`ml-1 font-semibold ${over ? "text-red-600" : "text-primary"}`}>({c.usagePct ?? 0}%)</span>
                          </span>
                        </div>
                      )}
                      {c.budgetAmount == null && <p className="text-xs text-muted-foreground mt-0.5">Consommé : {fmt(c.netConsumption)}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("Supprimer ce centre ?")) deleteMut.mutate(c.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Détail centre */}
      {detail && detailId && (
        <Card className="border-primary/30 mt-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm">{detail.code} — {detail.name} : ventilation par compte</CardTitle></CardHeader>
          <CardContent>
            {detail.charges?.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune imputation sur cette période</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Compte</TableHead><TableHead className="text-right">Débit</TableHead><TableHead className="text-right">Crédit</TableHead><TableHead className="text-right">Net</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {detail.charges?.map((c: any) => (
                    <TableRow key={c.accountCode}>
                      <TableCell><span className="font-mono text-xs text-muted-foreground mr-2">{c.accountCode}</span>{c.accountLabel}</TableCell>
                      <TableCell className="text-right">{fmt(c.totalDebit)}</TableCell>
                      <TableCell className="text-right">{fmt(c.totalCredit)}</TableCell>
                      <TableCell className={`text-right font-medium ${c.net < 0 ? "text-red-600" : ""}`}>{fmt(c.net)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold border-t-2">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{fmt(detail.totalDebit)}</TableCell>
                    <TableCell className="text-right">{fmt(detail.totalCredit)}</TableCell>
                    <TableCell className="text-right">{fmt(detail.netConsumption)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog créer / modifier */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editCC ? "Modifier le centre" : "Nouveau centre de coût"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Code *</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="ex: CC001" /></div>
              <div><Label>Libellé *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(CC_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Budget annuel (FCFA)</Label><Input type="number" value={form.budgetAmount} onChange={e => setForm({ ...form, budgetAmount: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending}>{editCC ? "Enregistrer" : "Créer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Onglet 3 — Comptes analytiques
// ═══════════════════════════════════════════════════════════════
type AnalAccount = { id: string; code: string; name: string; axis: string; type: string; description: string | null; isActive: boolean };

function AccountsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<AnalAccount | null>(null);
  const [form, setForm] = useState({ code: "", name: "", axis: "nature", type: "charges", description: "" });

  const { data, isLoading } = useQuery<{ data: AnalAccount[] }>({
    queryKey: ["cage-accounts"],
    queryFn: () => apiFetch("/api/analytics/accounts"),
  });
  const accounts = data?.data ?? [];

  // Regrouper par axe
  const byAxis = useMemo(() => {
    const map: Record<string, AnalAccount[]> = {};
    accounts.forEach(a => { if (!map[a.axis]) map[a.axis] = []; map[a.axis].push(a); });
    return map;
  }, [accounts]);

  function openCreate() { setForm({ code: "", name: "", axis: "nature", type: "charges", description: "" }); setEdit(null); setOpen(true); }
  function openEdit(a: AnalAccount) { setForm({ code: a.code, name: a.name, axis: a.axis, type: a.type, description: a.description ?? "" }); setEdit(a); setOpen(true); }

  const saveMut = useMutation({
    mutationFn: (d: typeof form) => {
      if (edit) return apiFetch(`/api/analytics/accounts/${edit.id}`, { method: "PATCH", body: JSON.stringify(d) });
      return apiFetch("/api/analytics/accounts", { method: "POST", body: JSON.stringify(d) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cage-accounts"] }); setOpen(false); toast({ title: edit ? "Compte mis à jour" : "Compte créé" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/analytics/accounts/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cage-accounts"] }); toast({ title: "Compte supprimé" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{accounts.length} compte{accounts.length !== 1 ? "s" : ""} analytique{accounts.length !== 1 ? "s" : ""}</p>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1" />Nouveau compte</Button>
      </div>

      {isLoading ? <Skeleton className="h-48 w-full" /> : accounts.length === 0 ? (
        <Card className="border-dashed"><CardContent className="py-12 text-center text-sm text-muted-foreground">Aucun compte analytique. Créez le plan analytique de votre organisation.</CardContent></Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(byAxis).map(([axis, accs]) => {
            const axisInfo = AXES[axis] ?? { label: axis, icon: <Layers className="w-3.5 h-3.5" /> };
            return (
              <div key={axis}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-muted-foreground">{axisInfo.icon}</span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{axisInfo.label}</h3>
                  <Separator className="flex-1" />
                </div>
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Code</TableHead><TableHead>Libellé</TableHead><TableHead>Type</TableHead><TableHead>Statut</TableHead><TableHead className="w-20"></TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {accs.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-xs">{a.code}</TableCell>
                        <TableCell className="font-medium">{a.name}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{a.type === "charges" ? "Charges" : a.type === "produits" ? "Produits" : "Mixte"}</Badge></TableCell>
                        <TableCell>{a.isActive ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <span className="text-xs text-muted-foreground">Inactif</span>}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)}><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("Supprimer ?")) deleteMut.mutate(a.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Modifier le compte" : "Nouveau compte analytique"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Code *</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="ex: CA001" /></div>
              <div><Label>Libellé *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Axe analytique</Label>
                <Select value={form.axis} onValueChange={v => setForm({ ...form, axis: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(AXES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="charges">Charges</SelectItem>
                    <SelectItem value="produits">Produits</SelectItem>
                    <SelectItem value="mixte">Mixte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending}>{edit ? "Enregistrer" : "Créer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Onglet 4 — Imputations analytiques
// ═══════════════════════════════════════════════════════════════
function ImputationsTab({ from, to }: { from: string; to: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<any>(null);
  const today = new Date().toISOString().slice(0, 10);
  const defaultPeriod = today.slice(0, 7);
  const [form, setForm] = useState({ date: today, period: defaultPeriod, accountId: "", costCenterId: "", amount: "", costType: "direct", label: "", reference: "", projectId: "", clientId: "" });
  const [filterCC, setFilterCC] = useState("");
  const [filterType, setFilterType] = useState("");

  const q = new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}), ...(filterCC ? { costCenterId: filterCC } : {}), ...(filterType ? { costType: filterType } : {}) }).toString();

  const { data, isLoading } = useQuery<{ data: any[]; total: number }>({
    queryKey: ["cage-entries", from, to, filterCC, filterType],
    queryFn: () => apiFetch(`/api/analytics/entries${q ? `?${q}` : ""}`),
  });
  const { data: accountsRes } = useQuery<{ data: any[] }>({ queryKey: ["cage-accounts"], queryFn: () => apiFetch("/api/analytics/accounts") });
  const { data: ccRes } = useQuery<any[]>({ queryKey: ["analytical-summary", "", ""], queryFn: () => apiFetch("/api/accounting/analytical/summary") });

  const entries = data?.data ?? [];
  const accounts = accountsRes?.data ?? [];
  const costCenters = ccRes ?? [];

  function openCreate() {
    setForm({ date: today, period: defaultPeriod, accountId: "", costCenterId: "", amount: "", costType: "direct", label: "", reference: "", projectId: "", clientId: "" });
    setEditEntry(null); setOpen(true);
  }
  function openEdit(e: any) {
    setForm({ date: e.entry.date, period: e.entry.period, accountId: e.entry.accountId ?? "", costCenterId: e.entry.costCenterId ?? "", amount: e.entry.amount, costType: e.entry.costType, label: e.entry.label, reference: e.entry.reference ?? "", projectId: e.entry.projectId ?? "", clientId: e.entry.clientId ?? "" });
    setEditEntry(e); setOpen(true);
  }

  const saveMut = useMutation({
    mutationFn: (d: typeof form) => {
      const body = { ...d, amount: Number(d.amount), accountId: d.accountId || null, costCenterId: d.costCenterId || null, projectId: d.projectId || null, clientId: d.clientId || null };
      if (editEntry) return apiFetch(`/api/analytics/entries/${editEntry.entry.id}`, { method: "PATCH", body: JSON.stringify(body) });
      return apiFetch("/api/analytics/entries", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cage-entries"] }); qc.invalidateQueries({ queryKey: ["cage-dashboard"] }); setOpen(false); toast({ title: editEntry ? "Imputation mise à jour" : "Imputation créée" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/analytics/entries/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cage-entries"] }); qc.invalidateQueries({ queryKey: ["cage-dashboard"] }); toast({ title: "Imputation supprimée" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end justify-between">
        <div className="flex gap-3 flex-wrap">
          <div>
            <Label className="text-xs">Centre de coût</Label>
            <Select value={filterCC} onValueChange={setFilterCC}>
              <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Tous les centres" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tous les centres</SelectItem>
                {costCenters.map((cc: any) => <SelectItem key={cc.id} value={cc.id}>{cc.code} — {cc.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Type de coût</Label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Tous" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tous</SelectItem>
                {COST_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1" />Nouvelle imputation</Button>
      </div>

      {isLoading ? <Skeleton className="h-48 w-full" /> : entries.length === 0 ? (
        <Card className="border-dashed"><CardContent className="py-12 text-center text-sm text-muted-foreground">Aucune imputation sur cette période.</CardContent></Card>
      ) : (
        <div className="rounded-lg border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead><TableHead>Libellé</TableHead><TableHead>Compte</TableHead>
                <TableHead>Centre</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Montant</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e: any) => {
                const amt = Number(e.entry.amount);
                const isCharge = amt > 0;
                return (
                  <TableRow key={e.entry.id}>
                    <TableCell className="text-xs">{e.entry.date}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">{e.entry.label}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.accountCode ? `${e.accountCode} ${e.accountName}` : "—"}</TableCell>
                    <TableCell className="text-xs">{e.ccCode ? `${e.ccCode}` : "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{COST_TYPES.find(t => t.value === e.entry.costType)?.label ?? e.entry.costType}</Badge></TableCell>
                    <TableCell className={`text-right font-medium text-sm ${isCharge ? "text-red-600" : "text-emerald-600"}`}>
                      {isCharge ? "+" : "-"}{fmt(Math.abs(amt))}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(e)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("Supprimer ?")) deleteMut.mutate(e.entry.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Totaux */}
      {entries.length > 0 && (() => {
        const totalC = entries.reduce((s: number, e: any) => s + Math.max(Number(e.entry.amount), 0), 0);
        const totalP = entries.reduce((s: number, e: any) => s + Math.abs(Math.min(Number(e.entry.amount), 0)), 0);
        return (
          <div className="flex gap-4 justify-end text-sm">
            <span className="text-muted-foreground">Charges : <strong className="text-red-600">{fmt(totalC)}</strong></span>
            <span className="text-muted-foreground">Produits : <strong className="text-emerald-600">{fmt(totalP)}</strong></span>
            <span className="text-muted-foreground">Solde : <strong className={totalP - totalC >= 0 ? "text-emerald-600" : "text-red-600"}>{fmt(totalP - totalC)}</strong></span>
          </div>
        );
      })()}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editEntry ? "Modifier l'imputation" : "Nouvelle imputation analytique"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date *</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value, period: e.target.value.slice(0, 7) })} /></div>
              <div><Label>Période</Label><Input value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} placeholder="YYYY-MM" /></div>
            </div>
            <div><Label>Libellé *</Label><Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Montant (FCFA) *</Label>
                <Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="+charge / -produit" />
              </div>
              <div>
                <Label>Type de coût</Label>
                <Select value={form.costType} onValueChange={v => setForm({ ...form, costType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{COST_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Compte analytique</Label>
                <Select value={form.accountId} onValueChange={v => setForm({ ...form, accountId: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                  <SelectContent>{accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Centre de coût</Label>
                <Select value={form.costCenterId} onValueChange={v => setForm({ ...form, costCenterId: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                  <SelectContent>{costCenters.map((cc: any) => <SelectItem key={cc.id} value={cc.id}>{cc.code} — {cc.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Référence</Label><Input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} placeholder="ex: FAC-2025-001" /></div>
            <p className="text-xs text-muted-foreground">Montant positif = charge · Montant négatif = produit (convention CAGE)</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending}>{editEntry ? "Enregistrer" : "Créer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Onglet 5 — Clés de répartition
// ═══════════════════════════════════════════════════════════════
type AllocationLine = { costCenterId: string; label: string; percentage: number };
type AllocationRule = { id: string; name: string; description: string | null; targetCostType: string | null; allocations: AllocationLine[]; isActive: boolean };

function AllocationRulesTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editRule, setEditRule] = useState<AllocationRule | null>(null);
  const [form, setForm] = useState({ name: "", description: "", targetCostType: "", allocations: [{ costCenterId: "", label: "", percentage: 0 }] as AllocationLine[] });

  const { data, isLoading } = useQuery<{ data: AllocationRule[] }>({ queryKey: ["cage-allocation-rules"], queryFn: () => apiFetch("/api/analytics/allocation-rules") });
  const { data: ccRes } = useQuery<any[]>({ queryKey: ["analytical-summary", "", ""], queryFn: () => apiFetch("/api/accounting/analytical/summary") });
  const rules = data?.data ?? [];
  const costCenters = ccRes ?? [];

  function openCreate() {
    setForm({ name: "", description: "", targetCostType: "", allocations: [{ costCenterId: "", label: "", percentage: 0 }] });
    setEditRule(null); setOpen(true);
  }
  function openEdit(r: AllocationRule) {
    setForm({ name: r.name, description: r.description ?? "", targetCostType: r.targetCostType ?? "", allocations: r.allocations.length ? r.allocations : [{ costCenterId: "", label: "", percentage: 0 }] });
    setEditRule(r); setOpen(true);
  }

  const totalPct = form.allocations.reduce((s, a) => s + (Number(a.percentage) || 0), 0);

  const saveMut = useMutation({
    mutationFn: (d: typeof form) => {
      if (editRule) return apiFetch(`/api/analytics/allocation-rules/${editRule.id}`, { method: "PATCH", body: JSON.stringify(d) });
      return apiFetch("/api/analytics/allocation-rules", { method: "POST", body: JSON.stringify(d) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cage-allocation-rules"] }); setOpen(false); toast({ title: editRule ? "Règle mise à jour" : "Règle créée" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/analytics/allocation-rules/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cage-allocation-rules"] }); toast({ title: "Règle supprimée" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  function addLine() { setForm(f => ({ ...f, allocations: [...f.allocations, { costCenterId: "", label: "", percentage: 0 }] })); }
  function removeLine(i: number) { setForm(f => ({ ...f, allocations: f.allocations.filter((_, j) => j !== i) })); }
  function updateLine(i: number, field: keyof AllocationLine, value: string | number) {
    setForm(f => { const a = [...f.allocations]; a[i] = { ...a[i], [field]: value }; return { ...f, allocations: a }; });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{rules.length} règle{rules.length !== 1 ? "s" : ""} de répartition</p>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1" />Nouvelle règle</Button>
      </div>

      {isLoading ? <Skeleton className="h-32 w-full" /> : rules.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            <p>Aucune clé de répartition définie.</p>
            <p className="text-xs mt-1">Les clés de répartition permettent de ventiler les charges indirectes entre centres de coût.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map(r => {
            const total = r.allocations.reduce((s, a) => s + Number(a.percentage), 0);
            return (
              <Card key={r.id}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">{r.name}</span>
                        {r.targetCostType && <Badge variant="outline" className="text-xs">{COST_TYPES.find(t => t.value === r.targetCostType)?.label ?? r.targetCostType}</Badge>}
                        <Badge variant={total === 100 ? "outline" : "destructive"} className="text-xs">{total}%</Badge>
                        {!r.isActive && <Badge variant="secondary" className="text-xs">Inactif</Badge>}
                      </div>
                      {r.description && <p className="text-xs text-muted-foreground mb-2">{r.description}</p>}
                      <div className="flex flex-wrap gap-2">
                        {r.allocations.map((a, i) => {
                          const cc = costCenters.find((c: any) => c.id === a.costCenterId);
                          return (
                            <div key={i} className="flex items-center gap-1 text-xs bg-slate-50 rounded px-2 py-0.5">
                              <span className="font-medium">{cc?.code ?? a.label}</span>
                              <span className="text-muted-foreground">{a.percentage}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("Supprimer ?")) deleteMut.mutate(r.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editRule ? "Modifier la règle" : "Nouvelle clé de répartition"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nom *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <Label>Type de coût ciblé</Label>
              <Select value={form.targetCostType} onValueChange={v => setForm({ ...form, targetCostType: v })}>
                <SelectTrigger><SelectValue placeholder="Tous types" /></SelectTrigger>
                <SelectContent>{COST_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <Separator />
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Répartition par centre ({totalPct}% / 100%)</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine} className="h-7 text-xs"><Plus className="w-3 h-3 mr-1" />Ligne</Button>
              </div>
              {totalPct !== 100 && <p className="text-xs text-amber-600 mb-2">Le total doit être égal à 100%</p>}
              <div className="space-y-2">
                {form.allocations.map((a, i) => (
                  <div key={i} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Select value={a.costCenterId} onValueChange={v => updateLine(i, "costCenterId", v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Centre de coût" /></SelectTrigger>
                        <SelectContent>{costCenters.map((cc: any) => <SelectItem key={cc.id} value={cc.id}>{cc.code} — {cc.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="w-20">
                      <Input type="number" className="h-8 text-xs" value={a.percentage} onChange={e => updateLine(i, "percentage", Number(e.target.value))} placeholder="%" min={0} max={100} />
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeLine(i)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending || totalPct !== 100}>{editRule ? "Enregistrer" : "Créer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Onglet 6 — Rapports analytiques
// ═══════════════════════════════════════════════════════════════
function ReportsTab({ from, to }: { from: string; to: string }) {
  const q = `${from ? `?from=${from}` : ""}${to ? `${from ? "&" : "?"}to=${to}` : ""}`;

  const { data: byCC } = useQuery<{ data: any[] }>({ queryKey: ["cage-rpt-by-cc", from, to], queryFn: () => apiFetch(`/api/analytics/reports/by-cost-center${q}`) });
  const { data: byProject } = useQuery<{ data: any[] }>({ queryKey: ["cage-rpt-by-project", from, to], queryFn: () => apiFetch(`/api/analytics/reports/by-project${q}`) });
  const { data: byClient } = useQuery<{ data: any[] }>({ queryKey: ["cage-rpt-by-client", from, to], queryFn: () => apiFetch(`/api/analytics/reports/by-client${q}`) });
  const { data: contrib } = useQuery<any>({ queryKey: ["cage-rpt-contribution", from, to], queryFn: () => apiFetch(`/api/analytics/reports/contribution${q}`) });
  const { data: is } = useQuery<any>({ queryKey: ["cage-rpt-income", from, to], queryFn: () => apiFetch(`/api/analytics/reports/income-statement${q}`) });

  const ccData = byCC?.data ?? [];
  const projectData = byProject?.data ?? [];
  const clientData = byClient?.data ?? [];

  return (
    <Tabs defaultValue="cc" className="w-full">
      <TabsList className="grid grid-cols-5 mb-4 h-auto gap-px">
        <TabsTrigger value="cc" className="text-xs"><Building2 className="w-3.5 h-3.5 mr-1" />Par centre</TabsTrigger>
        <TabsTrigger value="project" className="text-xs"><FolderKanban className="w-3.5 h-3.5 mr-1" />Par projet</TabsTrigger>
        <TabsTrigger value="client" className="text-xs"><Users className="w-3.5 h-3.5 mr-1" />Par client</TabsTrigger>
        <TabsTrigger value="contribution" className="text-xs"><BarChart3 className="w-3.5 h-3.5 mr-1" />Contribution</TabsTrigger>
        <TabsTrigger value="income" className="text-xs"><Layers className="w-3.5 h-3.5 mr-1" />Résultat</TabsTrigger>
      </TabsList>

      {/* Par centre de coût */}
      <TabsContent value="cc">
        {ccData.length === 0 ? <EmptyReport /> : (
          <div className="space-y-3">
            {ccData.map((cc: any) => (
              <Card key={cc.id}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="font-mono text-xs text-muted-foreground">{cc.code}</span>
                        <span className="font-semibold text-sm">{cc.name}</span>
                        <Badge variant="outline" className="text-xs">{CC_TYPES[cc.type] ?? cc.type}</Badge>
                        {cc.budgetPct != null && pctBadge(cc.budgetPct)}
                        {cc.marge >= 0
                          ? <Badge variant="outline" className="text-xs text-emerald-700 border-emerald-200 bg-emerald-50"><ArrowUpRight className="w-3 h-3 mr-0.5" />Positif</Badge>
                          : <Badge variant="destructive" className="text-xs"><ArrowDownRight className="w-3 h-3 mr-0.5" />Déficitaire</Badge>
                        }
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div><p className="text-xs text-muted-foreground">Charges directes</p><p className="font-medium">{fmt(cc.chargesDirect)}</p></div>
                        <div><p className="text-xs text-muted-foreground">Charges indirectes</p><p className="font-medium">{fmt(cc.chargesIndirect)}</p></div>
                        <div><p className="text-xs text-muted-foreground">Produits</p><p className="font-medium text-emerald-700">{fmt(cc.produits)}</p></div>
                        <div>
                          <p className="text-xs text-muted-foreground">Marge</p>
                          <p className={`font-bold ${cc.marge >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmt(cc.marge)}{cc.tauxMarge != null ? ` (${cc.tauxMarge}%)` : ""}</p>
                        </div>
                      </div>
                      {cc.budget != null && (
                        <div className="mt-2 flex items-center gap-3">
                          <Progress value={Math.min(cc.budgetPct ?? 0, 100)} className={`h-1.5 flex-1 ${cc.budgetPct > 100 ? "[&>div]:bg-red-500" : ""}`} />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">Budget : {fmt(cc.budget)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>

      {/* Par projet */}
      <TabsContent value="project">
        {projectData.length === 0 ? <EmptyReport msg="Aucune imputation liée à un projet." /> : (
          <div className="rounded-lg border overflow-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Projet</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Charges</TableHead><TableHead className="text-right">Produits</TableHead><TableHead className="text-right">Marge</TableHead><TableHead className="text-right">Taux</TableHead></TableRow></TableHeader>
              <TableBody>
                {projectData.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{p.status ?? "—"}</Badge></TableCell>
                    <TableCell className="text-right text-red-600">{fmt(p.charges)}</TableCell>
                    <TableCell className="text-right text-emerald-600">{fmt(p.produits)}</TableCell>
                    <TableCell className={`text-right font-bold ${p.marge >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmt(p.marge)}</TableCell>
                    <TableCell className="text-right text-sm">{p.tauxMarge != null ? `${p.tauxMarge}%` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>

      {/* Par client */}
      <TabsContent value="client">
        {clientData.length === 0 ? <EmptyReport msg="Aucune imputation liée à un client." /> : (
          <div className="rounded-lg border overflow-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Client</TableHead><TableHead className="text-right">Charges</TableHead><TableHead className="text-right">Produits</TableHead><TableHead className="text-right">Marge</TableHead><TableHead className="text-right">Taux</TableHead></TableRow></TableHeader>
              <TableBody>
                {clientData.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name ?? "—"}</TableCell>
                    <TableCell className="text-right text-red-600">{fmt(c.charges)}</TableCell>
                    <TableCell className="text-right text-emerald-600">{fmt(c.produits)}</TableCell>
                    <TableCell className={`text-right font-bold ${c.marge >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmt(c.marge)}</TableCell>
                    <TableCell className="text-right text-sm">{c.tauxMarge != null ? `${c.tauxMarge}%` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>

      {/* Contribution marginale */}
      <TabsContent value="contribution">
        {!contrib ? <Skeleton className="h-48 w-full" /> : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPI label="Chiffre d'affaires" value={fmt(contrib.chiffreAffaires)} icon={TrendingUp} accent="info" />
              <KPI label="Charges variables" value={fmt(contrib.chargesVariables)} icon={TrendingDown} accent="warning" />
              <KPI label="Charges fixes" value={fmt(contrib.chargesFixes)} icon={Minus} accent="default" />
              <KPI label="Marge / coût variable" value={fmt(contrib.margeContribution)}
                icon={contrib.margeContribution >= 0 ? ArrowUpRight : ArrowDownRight}
                accent={contrib.margeContribution >= 0 ? "success" : "danger"}
                sub={`Taux : ${contrib.tauxContribution}%`} />
            </div>
            {contrib.pointMort != null && (
              <Card className="bg-amber-50 border-amber-200">
                <CardContent className="py-4 px-5">
                  <div className="flex items-center gap-3">
                    <Target className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-amber-800">Seuil de rentabilité (point mort)</p>
                      <p className="text-2xl font-bold text-amber-700">{fmt(contrib.pointMort)}</p>
                      <p className="text-xs text-amber-600">Charges fixes ({fmt(contrib.chargesFixes)}) ÷ Taux de contribution ({contrib.tauxContribution}%)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {contrib.byCC?.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">Contribution par centre de coût</h3>
                <div className="rounded-lg border overflow-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Centre</TableHead><TableHead className="text-right">CA</TableHead><TableHead className="text-right">Ch. variables</TableHead><TableHead className="text-right">Ch. fixes</TableHead><TableHead className="text-right">Marge contrib.</TableHead><TableHead className="text-right">Taux</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {contrib.byCC.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-sm font-medium">{r.code} — {r.name}</TableCell>
                          <TableCell className="text-right">{fmt(r.produits)}</TableCell>
                          <TableCell className="text-right text-amber-600">{fmt(r.chargesVariables)}</TableCell>
                          <TableCell className="text-right">{fmt(r.chargesFixes)}</TableCell>
                          <TableCell className={`text-right font-bold ${r.margeContribution >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmt(r.margeContribution)}</TableCell>
                          <TableCell className="text-right">{r.tauxContribution}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}
      </TabsContent>

      {/* Compte de résultat analytique */}
      <TabsContent value="income">
        {!is ? <Skeleton className="h-48 w-full" /> : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <KPI label="Produits" value={fmt(is.totalProduits)} icon={TrendingUp} accent="success" />
              <KPI label="Charges" value={fmt(is.totalCharges)} icon={TrendingDown} accent="danger" />
              <KPI label="Résultat" value={fmt(is.resultat)} icon={is.resultat >= 0 ? ArrowUpRight : ArrowDownRight}
                accent={is.resultat >= 0 ? "success" : "danger"} sub={`Taux de marge : ${is.tauxMarge}%`} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {is.produits?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold text-emerald-700 uppercase">Produits analytiques</CardTitle></CardHeader>
                  <CardContent className="pt-0">
                    <Table>
                      <TableHeader><TableRow><TableHead>Compte</TableHead><TableHead className="text-right">Montant</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {is.produits.map((r: any) => (
                          <TableRow key={r.id ?? r.code}>
                            <TableCell className="text-sm">{r.code ? `${r.code} — ` : ""}{r.name ?? "Sans compte"}</TableCell>
                            <TableCell className="text-right text-emerald-600 font-medium">{fmt(r.amount)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold border-t-2"><TableCell>Total produits</TableCell><TableCell className="text-right text-emerald-700">{fmt(is.totalProduits)}</TableCell></TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
              {is.charges?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold text-red-700 uppercase">Charges analytiques</CardTitle></CardHeader>
                  <CardContent className="pt-0">
                    <Table>
                      <TableHeader><TableRow><TableHead>Compte</TableHead><TableHead className="text-right">Montant</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {is.charges.map((r: any) => (
                          <TableRow key={r.id ?? r.code}>
                            <TableCell className="text-sm">{r.code ? `${r.code} — ` : ""}{r.name ?? "Sans compte"}</TableCell>
                            <TableCell className="text-right text-red-600 font-medium">{fmt(r.amount)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold border-t-2"><TableCell>Total charges</TableCell><TableCell className="text-right text-red-700">{fmt(is.totalCharges)}</TableCell></TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
            {is.totalProduits === 0 && is.totalCharges === 0 && <EmptyReport />}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

function EmptyReport({ msg }: { msg?: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-12 text-center text-sm text-muted-foreground">
        <BarChart3 className="w-8 h-8 mx-auto opacity-30 mb-2" />
        <p>{msg ?? "Aucune donnée sur cette période. Créez des imputations analytiques pour alimenter les rapports."}</p>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// Page principale CAGE
// ═══════════════════════════════════════════════════════════════
export default function AnalyticalPage() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10);
  const lastDay = new Date(today.getFullYear(), 11, 31).toISOString().slice(0, 10);
  const [from, setFrom] = useState(firstDay);
  const [to, setTo] = useState(lastDay);

  return (
    <AccountingShell
      title="Comptabilité Analytique (CAGE)"
      subtitle="Pilotage des coûts, marges et rentabilité par axe analytique"
    >
      {/* Barre de filtres globale */}
      <div className="flex flex-wrap items-center gap-3 mb-6 p-3 bg-slate-50 rounded-xl border">
        <div className="flex items-center gap-2">
          <Label className="text-xs font-semibold text-muted-foreground">Période</Label>
          <Input type="date" className="w-36 h-8 text-xs" value={from} onChange={e => setFrom(e.target.value)} />
          <span className="text-xs text-muted-foreground">—</span>
          <Input type="date" className="w-36 h-8 text-xs" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <div className="flex gap-2 ml-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => {
            const y = today.getFullYear(); const m = today.getMonth();
            setFrom(new Date(y, m, 1).toISOString().slice(0, 10));
            setTo(new Date(y, m + 1, 0).toISOString().slice(0, 10));
          }}>Mois</Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => {
            const y = today.getFullYear();
            setFrom(`${y}-01-01`); setTo(`${y}-12-31`);
          }}>Année</Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => {
            const y = today.getFullYear() - 1;
            setFrom(`${y}-01-01`); setTo(`${y}-12-31`);
          }}>N-1</Button>
        </div>
      </div>

      {/* Onglets CAGE */}
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid grid-cols-3 md:grid-cols-6 mb-6 h-auto gap-px">
          <TabsTrigger value="dashboard" className="text-xs"><BarChart3 className="w-3.5 h-3.5 mr-1" />Tableau de bord</TabsTrigger>
          <TabsTrigger value="cost-centers" className="text-xs"><Building2 className="w-3.5 h-3.5 mr-1" />Centres</TabsTrigger>
          <TabsTrigger value="accounts" className="text-xs"><Layers className="w-3.5 h-3.5 mr-1" />Plan analytique</TabsTrigger>
          <TabsTrigger value="entries" className="text-xs"><Tag className="w-3.5 h-3.5 mr-1" />Imputations</TabsTrigger>
          <TabsTrigger value="allocation" className="text-xs"><Settings2 className="w-3.5 h-3.5 mr-1" />Répartitions</TabsTrigger>
          <TabsTrigger value="reports" className="text-xs"><PieChart className="w-3.5 h-3.5 mr-1" />Rapports</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><DashboardTab from={from} to={to} /></TabsContent>
        <TabsContent value="cost-centers"><CostCentersTab from={from} to={to} /></TabsContent>
        <TabsContent value="accounts"><AccountsTab /></TabsContent>
        <TabsContent value="entries"><ImputationsTab from={from} to={to} /></TabsContent>
        <TabsContent value="allocation"><AllocationRulesTab /></TabsContent>
        <TabsContent value="reports"><ReportsTab from={from} to={to} /></TabsContent>
      </Tabs>
    </AccountingShell>
  );
}
