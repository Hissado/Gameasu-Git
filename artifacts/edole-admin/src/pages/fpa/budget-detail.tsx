import { useEffect, useMemo, useState } from "react";
import { useRoute, Link } from "wouter";
import { apiFetch } from "@/lib/api";
import { formatFCFA } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Plus, Trash2, FileSpreadsheet, Activity } from "lucide-react";
import { toast as baseToast } from "@/hooks/use-toast";

const toast = {
  success: (msg: string) => baseToast({ title: msg }),
  error: (msg: string) => baseToast({ title: msg, variant: "destructive" }),
};

interface Account { id: string; code: string; label: string; classNum: number; normalBalance: string; isPostable: boolean; }
interface Budget {
  id: string; name: string; kind: string; scope: string; scopeId: string | null;
  versionNumber: number; status: string; fiscalPeriodId: string;
  notes?: string | null; lines: Array<{ id?: string; accountId: string; period: string; amount: number; notes?: string | null }>;
}
interface FiscalPeriod { id: string; name: string; startDate: string; endDate: string; }

function listMonths(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  const cur = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 1));
  const last = new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), 1));
  while (cur <= last) {
    out.push(`${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, "0")}`);
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return out;
}

const MONTH_LABEL: Record<string, string> = {
  "01": "Jan", "02": "Fév", "03": "Mar", "04": "Avr", "05": "Mai", "06": "Juin",
  "07": "Juil", "08": "Août", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Déc",
};

export default function BudgetDetailPage() {
  const [, params] = useRoute<{ id: string }>("/fpa/budgets/:id");
  const id = params?.id || "";
  const [budget, setBudget] = useState<Budget | null>(null);
  const [period, setPeriod] = useState<FiscalPeriod | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [grid, setGrid] = useState<Map<string, number>>(new Map());
  const [activeAccountIds, setActiveAccountIds] = useState<string[]>([]);
  const [accountToAdd, setAccountToAdd] = useState<string>("");
  const [classFilter, setClassFilter] = useState<string>("6");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    apiFetch<Budget>(`/api/fpa/budgets/${id}`).then((b) => {
      setBudget(b);
      const m = new Map<string, number>();
      b.lines.forEach((l) => m.set(`${l.accountId}::${l.period}`, l.amount));
      setGrid(m);
      const ids = Array.from(new Set(b.lines.map((l) => l.accountId)));
      setActiveAccountIds(ids);
      apiFetch<{ data: FiscalPeriod[] }>("/api/accounting/fiscal-periods").then((r) => {
        setPeriod(r.data.find((p) => p.id === b.fiscalPeriodId) || null);
      });
    });
    apiFetch<{ data: Account[] }>("/api/accounting/chart-of-accounts").then((r) => setAccounts(r.data));
  }, [id]);

  const months = useMemo(() => period ? listMonths(period.startDate, period.endDate) : [], [period]);
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const postable = useMemo(() => accounts.filter((a) => a.isPostable), [accounts]);
  const accountChoices = useMemo(() => {
    if (classFilter === "all") return postable;
    return postable.filter((a) => a.classNum === parseInt(classFilter));
  }, [postable, classFilter]);

  function setCell(accountId: string, period: string, value: number) {
    const m = new Map(grid);
    m.set(`${accountId}::${period}`, value);
    setGrid(m);
  }

  function addAccount() {
    if (!accountToAdd || activeAccountIds.includes(accountToAdd)) return;
    setActiveAccountIds([...activeAccountIds, accountToAdd]);
    setAccountToAdd("");
  }

  function removeAccount(aid: string) {
    setActiveAccountIds(activeAccountIds.filter((x) => x !== aid));
    const m = new Map(grid);
    months.forEach((mo) => m.delete(`${aid}::${mo}`));
    setGrid(m);
  }

  function fillRow(aid: string, value: number) {
    const m = new Map(grid);
    months.forEach((mo) => m.set(`${aid}::${mo}`, value));
    setGrid(m);
  }

  async function save() {
    if (!budget) return;
    const lines: any[] = [];
    activeAccountIds.forEach((aid) => {
      months.forEach((mo) => {
        const v = grid.get(`${aid}::${mo}`) || 0;
        if (v !== 0) lines.push({ accountId: aid, period: mo, amount: v });
      });
    });
    setSaving(true);
    try {
      await apiFetch(`/api/fpa/budgets/${id}/lines`, { method: "PUT", body: { lines } });
      toast.success(`${lines.length} lignes enregistrées`);
    } catch (e: any) { toast.error(e.message || "Erreur"); }
    finally { setSaving(false); }
  }

  const totalsByAccount = useMemo(() => {
    const m = new Map<string, number>();
    activeAccountIds.forEach((aid) => {
      m.set(aid, months.reduce((s, mo) => s + (grid.get(`${aid}::${mo}`) || 0), 0));
    });
    return m;
  }, [activeAccountIds, months, grid]);

  const totalsByMonth = useMemo(() => {
    return months.map((mo) =>
      activeAccountIds.reduce((s, aid) => s + (grid.get(`${aid}::${mo}`) || 0), 0),
    );
  }, [months, activeAccountIds, grid]);

  const grandTotal = totalsByMonth.reduce((s, v) => s + v, 0);

  if (!budget) return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/fpa/budgets" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Retour aux budgets
          </Link>
          <h1 className="text-2xl font-bold mt-2">{budget.name}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant={budget.kind === "forecast" ? "outline" : "secondary"}>
              {budget.kind === "forecast" ? "Forecast" : "Budget"}
            </Badge>
            <Badge variant="outline">v{budget.versionNumber}</Badge>
            <Badge variant="outline">{budget.status}</Badge>
            {period && <span className="text-sm text-muted-foreground">{period.name}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/fpa/variance?budgetId=${id}`}>
            <Button variant="outline"><Activity className="w-4 h-4 mr-2" />Voir variance</Button>
          </Link>
          <a href={`/api/fpa/export/budget/${id}.xlsx?token=${encodeURIComponent(localStorage.getItem("auth_token") || "")}`} download>
            <Button variant="outline"><FileSpreadsheet className="w-4 h-4 mr-2" />Excel</Button>
          </a>
          <Button onClick={save} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />{saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex items-end gap-2 flex-wrap">
          <div className="min-w-[120px]">
            <label className="text-xs text-muted-foreground">Classe</label>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="6">6 — Charges</SelectItem>
                <SelectItem value="7">7 — Produits</SelectItem>
                <SelectItem value="2">2 — Immobilisations</SelectItem>
                <SelectItem value="4">4 — Tiers</SelectItem>
                <SelectItem value="5">5 — Trésorerie</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[280px]">
            <label className="text-xs text-muted-foreground">Ajouter un compte</label>
            <Select value={accountToAdd} onValueChange={setAccountToAdd}>
              <SelectTrigger><SelectValue placeholder="Choisir un compte du plan SYSCOHADA…" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {accountChoices.filter((a) => !activeAccountIds.includes(a.id)).map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.code} — {a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={addAccount} disabled={!accountToAdd}><Plus className="w-4 h-4 mr-1" />Ajouter</Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {activeAccountIds.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <p>Aucune ligne. Ajoutez un compte pour commencer.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-sm border-separate border-spacing-0">
              <thead className="bg-muted/40 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left sticky left-0 bg-muted/40 z-10 min-w-[260px] border-b border-r">Compte</th>
                  {months.map((m) => (
                    <th key={m} className="px-2 py-2 text-right text-xs border-b min-w-[110px]">
                      <div className="font-semibold">{MONTH_LABEL[m.slice(5)]}</div>
                      <div className="text-muted-foreground">{m.slice(0, 4)}</div>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right text-xs border-b border-l bg-amber-50 sticky right-12 min-w-[130px]">Total</th>
                  <th className="px-2 py-2 border-b sticky right-0 bg-muted/40 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {activeAccountIds.map((aid) => {
                  const acc = accountById.get(aid);
                  return (
                    <tr key={aid} className="hover:bg-muted/20">
                      <td className="px-3 py-1.5 sticky left-0 bg-card hover:bg-muted/20 border-b border-r">
                        <div className="font-medium">{acc?.code}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[240px]">{acc?.label}</div>
                        <button
                          type="button"
                          className="text-[10px] text-primary hover:underline mt-0.5"
                          onClick={() => {
                            const v = parseFloat(prompt("Répartir uniformément ce montant sur tous les mois :", "0") || "0");
                            if (!isNaN(v)) fillRow(aid, Math.round(v / months.length));
                          }}
                        >
                          Répartir un total
                        </button>
                      </td>
                      {months.map((mo) => (
                        <td key={mo} className="px-1 py-1 border-b">
                          <Input
                            type="number"
                            step="any"
                            value={grid.get(`${aid}::${mo}`) ?? ""}
                            onChange={(e) => setCell(aid, mo, parseFloat(e.target.value) || 0)}
                            className="h-8 text-right text-xs px-1.5"
                          />
                        </td>
                      ))}
                      <td className="px-3 py-1.5 text-right font-semibold bg-amber-50/60 border-b border-l sticky right-12">
                        {formatFCFA(totalsByAccount.get(aid) || 0)}
                      </td>
                      <td className="px-1 py-1 border-b sticky right-0 bg-card">
                        <Button size="sm" variant="ghost" onClick={() => removeAccount(aid)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-amber-50/80 font-bold">
                  <td className="px-3 py-2 sticky left-0 bg-amber-50/80 border-t-2 border-amber-200">TOTAL</td>
                  {totalsByMonth.map((t, i) => (
                    <td key={i} className="px-2 py-2 text-right text-xs border-t-2 border-amber-200">{formatFCFA(t)}</td>
                  ))}
                  <td className="px-3 py-2 text-right border-t-2 border-amber-200 bg-amber-100 sticky right-12">{formatFCFA(grandTotal)}</td>
                  <td className="border-t-2 border-amber-200 sticky right-0 bg-amber-50/80"></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
