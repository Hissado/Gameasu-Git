/**
 * Page Moteur Fiscal
 * Route : /fiscal/moteur
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calculator, AlertCircle, CheckCircle, Clock,
  Plus, Play, Download, RefreshCw, Zap, TrendingUp,
  ChevronRight, BarChart3, FileText, Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { formatFCFA } from "@/lib/format";
import { apiRequest } from "@/lib/queryClient";

// ─── Types ───────────────────────────────────────────────────────────────────
interface TaxObligation {
  id: string;
  taxCode: string;
  taxLabel: string;
  fiscalYear: string;
  period: string;
  periodLabel: string;
  status: string;
  calculatedAmount?: number;
  declaredAmount?: number;
  paidAmount: number;
  balance?: number;
  dueDate: string;
  daysUntilDue?: number;
  daysOverdue?: number;
}

interface TaxRate {
  id: string;
  taxCode: string;
  taxLabel: string;
  rate?: number;
  calculationBase: string;
  declarationFrequency: string;
  dueDayOfPeriod?: number;
  isActive: boolean;
}

interface SimResult {
  tva:     { collected: number; deductible: number; net: number };
  is:      { calculated: number; imf: number; payable: number };
  patente: { amount: number; sector: string };
  cnss:    { employerShare: number };
  irpp:    { estimated: number };
  ipts:    { total: number };
  totaux:  { charges_fiscales: number; charges_sociales: number; total: number; effective_rate: number };
}

interface Dashboard {
  summary: {
    upcoming: number; overdue: number; paid: number; total: number;
    totalDue: number; totalPaid: number;
  };
  upcomingObligations: TaxObligation[];
  overdueObligations: TaxObligation[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const FREQ_LABEL: Record<string, string> = {
  monthly: "Mensuelle", quarterly: "Trimestrielle", annual: "Annuelle", on_event: "Sur événement",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  upcoming: { label: "À venir",   color: "text-blue-400",   icon: Clock },
  due:      { label: "Exigible",  color: "text-amber-400",  icon: AlertCircle },
  overdue:  { label: "En retard", color: "text-red-400",    icon: AlertCircle },
  paid:     { label: "Payée",     color: "text-emerald-400",icon: CheckCircle },
  submitted:{ label: "Déposée",   color: "text-purple-400", icon: FileText },
};

function formatPeriod(period: string) {
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split("-");
    const months = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
    return `${months[Number(m) - 1]} ${y}`;
  }
  return period;
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function FiscalEnginePage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("dashboard");
  const [showSimulate, setShowSimulate] = useState(false);
  const [showAddObligation, setShowAddObligation] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState<TaxObligation | null>(null);
  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [simLabel, setSimLabel] = useState("");
  const [simSave, setSimSave] = useState(false);

  const currentYear = String(new Date().getFullYear());

  const [simForm, setSimForm] = useState({
    turnover: "",
    netProfit: "",
    vatDeductible: "",
    sector: "SE",
    employeeCount: "",
    totalGrossSalary: "",
    fiscalYear: currentYear,
  });

  const [obligForm, setObligForm] = useState({
    taxCode: "TVA",
    taxLabel: "Taxe sur la Valeur Ajoutée",
    fiscalYear: currentYear,
    period: "",
    periodLabel: "",
    declaredAmount: "",
    dueDate: "",
    obligationType: "payment",
  });

  const [payForm, setPayForm] = useState({
    amount: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMethod: "virement",
    referenceNumber: "",
    notes: "",
  });

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: dashboard } = useQuery<Dashboard>({
    queryKey: ["/api/fiscal/engine/dashboard"],
    queryFn: () => apiRequest("GET", "/api/fiscal/engine/dashboard"),
  });

  const { data: obligations = [], isLoading: obligLoading } = useQuery<TaxObligation[]>({
    queryKey: ["/api/fiscal/engine/obligations", currentYear],
    queryFn: () => apiRequest("GET", `/api/fiscal/engine/obligations?fiscalYear=${currentYear}`),
    enabled: tab === "obligations",
  });

  const { data: rates = [] } = useQuery<TaxRate[]>({
    queryKey: ["/api/fiscal/engine/rates"],
    queryFn: () => apiRequest("GET", "/api/fiscal/engine/rates"),
    enabled: tab === "taux",
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/api/fiscal/engine/dashboard"] });
    qc.invalidateQueries({ queryKey: ["/api/fiscal/engine/obligations"] });
  };

  const seedMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/fiscal/engine/seed-togo"),
    onSuccess: (data: { message: string }) => {
      toast({ title: data.message });
      qc.invalidateQueries({ queryKey: ["/api/fiscal/engine/rates"] });
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const simulateMut = useMutation({
    mutationFn: (data: unknown) => apiRequest("POST", "/api/fiscal/engine/simulate", data),
    onSuccess: (data: { results: SimResult }) => {
      setSimResult(data.results);
    },
    onError: (e: Error) => toast({ title: "Erreur de simulation", description: e.message, variant: "destructive" }),
  });

  const addObligMut = useMutation({
    mutationFn: (data: unknown) => apiRequest("POST", "/api/fiscal/engine/obligations", data),
    onSuccess: () => {
      toast({ title: "Obligation créée" });
      setShowAddObligation(false);
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const payMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      apiRequest("POST", `/api/fiscal/engine/obligations/${id}/pay`, data),
    onSuccess: () => {
      toast({ title: "Paiement enregistré" });
      setShowPayDialog(null);
      invalidate();
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const TAX_CODES = [
    { code: "TVA", label: "Taxe sur la Valeur Ajoutée" },
    { code: "IS",  label: "Impôt sur les Sociétés" },
    { code: "IMF", label: "Impôt Minimum Forfaitaire" },
    { code: "PATENTE", label: "Patente" },
    { code: "IRPP", label: "IRPP (retenues à la source)" },
    { code: "CNSS", label: "Cotisations CNSS" },
    { code: "IPTS", label: "Impôt sur Traitements et Salaires" },
    { code: "RS",   label: "Retenue à la Source" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Moteur fiscal</h1>
          <p className="text-sm text-white/50 mt-0.5">Obligations OHADA/Togo — TVA, IS, IMF, Patente, IRPP</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSimulate(true)}>
            <Calculator className="w-4 h-4 mr-1.5" /> Simuler la charge fiscale
          </Button>
          <Button size="sm" onClick={() => setShowAddObligation(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Nouvelle obligation
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white/[0.04] border border-white/[0.07]">
          <TabsTrigger value="dashboard">Tableau de bord</TabsTrigger>
          <TabsTrigger value="obligations">Obligations</TabsTrigger>
          <TabsTrigger value="taux">Taux configurés</TabsTrigger>
        </TabsList>

        {/* ── DASHBOARD ───────────────────────────────────────────────────── */}
        <TabsContent value="dashboard" className="mt-4 space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="bg-red-500/10 border-red-500/20">
              <CardContent className="p-4">
                <p className="text-xs text-red-300/70">En retard</p>
                <p className="text-2xl font-bold text-red-400 mt-1">{dashboard?.summary.overdue ?? 0}</p>
                <p className="text-xs text-red-300/50 mt-0.5">{formatFCFA(dashboard?.summary.totalDue ?? 0)} à régulariser</p>
              </CardContent>
            </Card>
            <Card className="bg-amber-500/10 border-amber-500/20">
              <CardContent className="p-4">
                <p className="text-xs text-amber-300/70">À venir (30j)</p>
                <p className="text-2xl font-bold text-amber-400 mt-1">{dashboard?.summary.upcoming ?? 0}</p>
              </CardContent>
            </Card>
            <Card className="bg-emerald-500/10 border-emerald-500/20">
              <CardContent className="p-4">
                <p className="text-xs text-emerald-300/70">Payées</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1">{dashboard?.summary.paid ?? 0}</p>
                <p className="text-xs text-emerald-300/50 mt-0.5">{formatFCFA(dashboard?.summary.totalPaid ?? 0)}</p>
              </CardContent>
            </Card>
            <Card className="bg-white/[0.03] border-white/[0.07]">
              <CardContent className="p-4">
                <p className="text-xs text-white/50">Total obligations</p>
                <p className="text-2xl font-bold text-white mt-1">{dashboard?.summary.total ?? 0}</p>
              </CardContent>
            </Card>
          </div>

          {/* Obligations en retard */}
          {(dashboard?.overdueObligations?.length ?? 0) > 0 && (
            <Card className="bg-red-500/5 border-red-500/20">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold text-red-400 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" /> Obligations en retard
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {dashboard!.overdueObligations.map((o) => (
                  <div key={o.id} className="flex items-center justify-between py-2 border-b border-red-500/10 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-white">{o.taxLabel}</p>
                      <p className="text-xs text-white/40">{formatPeriod(o.period)} · {o.daysOverdue}j de retard</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-red-400">{formatFCFA(o.balance ?? 0)}</p>
                      <Button
                        variant="ghost" size="sm" className="h-6 text-xs text-red-400/70 hover:text-red-400 px-2"
                        onClick={() => { setShowPayDialog(o); setPayForm({ amount: String(o.balance ?? 0), paymentDate: new Date().toISOString().slice(0, 10), paymentMethod: "virement", referenceNumber: "", notes: "" }); }}
                      >
                        Régulariser
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* À venir */}
          {(dashboard?.upcomingObligations?.length ?? 0) > 0 && (
            <Card className="bg-white/[0.03] border-white/[0.07]">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> Prochaines échéances (30 jours)
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {dashboard!.upcomingObligations.map((o) => (
                  <div key={o.id} className="flex items-center justify-between py-2 border-b border-white/[0.05] last:border-0">
                    <div>
                      <p className="text-sm font-medium text-white">{o.taxLabel}</p>
                      <p className="text-xs text-white/40">{formatPeriod(o.period)} · dans {o.daysUntilDue}j</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-white/70">{o.calculatedAmount ? formatFCFA(o.calculatedAmount) : "—"}</p>
                      <p className="text-xs text-white/30">Échéance : {o.dueDate}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {(dashboard?.summary.total ?? 0) === 0 && (
            <div className="text-center py-16 text-white/30">
              <Calculator className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucune obligation fiscale enregistrée.</p>
              <p className="text-xs mt-1">Ajoutez vos obligations ou configurez les taux Togo pour commencer.</p>
            </div>
          )}
        </TabsContent>

        {/* ── OBLIGATIONS ─────────────────────────────────────────────────── */}
        <TabsContent value="obligations" className="mt-4">
          <div className="rounded-lg border border-white/[0.07] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] border-b border-white/[0.07]">
                <tr>
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Impôt / Taxe</th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Période</th>
                  <th className="text-right px-4 py-3 text-white/50 font-medium">Montant</th>
                  <th className="text-right px-4 py-3 text-white/50 font-medium">Payé</th>
                  <th className="text-right px-4 py-3 text-white/50 font-medium">Solde</th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Échéance</th>
                  <th className="text-left px-4 py-3 text-white/50 font-medium">Statut</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {obligLoading ? (
                  <tr><td colSpan={8} className="text-center py-12 text-white/30">Chargement…</td></tr>
                ) : obligations.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-white/30">Aucune obligation pour {currentYear}</td></tr>
                ) : obligations.map((o) => {
                  const cfg = STATUS_CONFIG[o.status] ?? STATUS_CONFIG.upcoming;
                  return (
                    <tr key={o.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-medium text-white">{o.taxLabel}</td>
                      <td className="px-4 py-3 text-white/60">{formatPeriod(o.period)}</td>
                      <td className="px-4 py-3 text-right text-white">{o.declaredAmount ? formatFCFA(o.declaredAmount) : "—"}</td>
                      <td className="px-4 py-3 text-right text-emerald-400">{formatFCFA(o.paidAmount)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${(o.balance ?? 0) > 0 ? "text-red-400" : "text-white/40"}`}>
                        {o.balance ? formatFCFA(o.balance) : "—"}
                      </td>
                      <td className="px-4 py-3 text-white/60">{o.dueDate}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        {o.status !== "paid" && (
                          <Button
                            variant="ghost" size="sm" className="h-7 text-xs"
                            onClick={() => { setShowPayDialog(o); setPayForm({ amount: String(o.balance ?? o.declaredAmount ?? 0), paymentDate: new Date().toISOString().slice(0, 10), paymentMethod: "virement", referenceNumber: "", notes: "" }); }}
                          >
                            Payer
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── TAUX ────────────────────────────────────────────────────────── */}
        <TabsContent value="taux" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-white/50">{rates.length} taux configurés</p>
            <Button variant="outline" size="sm" onClick={() => seedMut.mutate()} disabled={seedMut.isPending}>
              <Zap className="w-4 h-4 mr-1.5" /> {seedMut.isPending ? "Seeding…" : "Initialiser taux Togo"}
            </Button>
          </div>
          {rates.length === 0 ? (
            <div className="text-center py-16 text-white/30">
              <Settings className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucun taux configuré.</p>
              <p className="text-xs mt-1">Cliquez sur "Initialiser taux Togo" pour pré-remplir le référentiel fiscal togolais.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-white/[0.07] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.03] border-b border-white/[0.07]">
                  <tr>
                    <th className="text-left px-4 py-3 text-white/50 font-medium">Code</th>
                    <th className="text-left px-4 py-3 text-white/50 font-medium">Libellé</th>
                    <th className="text-right px-4 py-3 text-white/50 font-medium">Taux</th>
                    <th className="text-left px-4 py-3 text-white/50 font-medium">Base</th>
                    <th className="text-left px-4 py-3 text-white/50 font-medium">Fréquence</th>
                    <th className="text-right px-4 py-3 text-white/50 font-medium">J. limite</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map((r) => (
                    <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="font-mono text-xs">{r.taxCode}</Badge>
                      </td>
                      <td className="px-4 py-3 text-white/80">{r.taxLabel}</td>
                      <td className="px-4 py-3 text-right font-semibold text-white">{r.rate ? `${r.rate}%` : "Barème"}</td>
                      <td className="px-4 py-3 text-white/50 text-xs">{r.calculationBase}</td>
                      <td className="px-4 py-3 text-white/50 text-xs">{FREQ_LABEL[r.declarationFrequency] ?? r.declarationFrequency}</td>
                      <td className="px-4 py-3 text-right text-white/50">{r.dueDayOfPeriod ? `J+${r.dueDayOfPeriod}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Dialogue : Simulation ──────────────────────────────────────── */}
      <Dialog open={showSimulate} onOpenChange={(o) => { setShowSimulate(o); if (!o) setSimResult(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Simulation de charge fiscale — Togo {currentYear}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Chiffre d'affaires HT (FCFA)</Label>
              <Input type="number" value={simForm.turnover} onChange={(e) => setSimForm((f) => ({ ...f, turnover: e.target.value }))} placeholder="ex : 500 000 000" />
            </div>
            <div className="space-y-1.5">
              <Label>Résultat net (FCFA)</Label>
              <Input type="number" value={simForm.netProfit} onChange={(e) => setSimForm((f) => ({ ...f, netProfit: e.target.value }))} placeholder="ex : 50 000 000" />
            </div>
            <div className="space-y-1.5">
              <Label>TVA déductible (FCFA)</Label>
              <Input type="number" value={simForm.vatDeductible} onChange={(e) => setSimForm((f) => ({ ...f, vatDeductible: e.target.value }))} placeholder="ex : 10 000 000" />
            </div>
            <div className="space-y-1.5">
              <Label>Secteur d'activité</Label>
              <Select value={simForm.sector} onValueChange={(v) => setSimForm((f) => ({ ...f, sector: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CO">Commerce / Hôtellerie / Pharmacie</SelectItem>
                  <SelectItem value="SE">Services / Assurances</SelectItem>
                  <SelectItem value="BTP">BTP / Construction</SelectItem>
                  <SelectItem value="TEL">Téléphonie / Technologies</SelectItem>
                  <SelectItem value="IND">Industries</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nombre d'employés</Label>
              <Input type="number" value={simForm.employeeCount} onChange={(e) => setSimForm((f) => ({ ...f, employeeCount: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Masse salariale brute annuelle (FCFA)</Label>
              <Input type="number" value={simForm.totalGrossSalary} onChange={(e) => setSimForm((f) => ({ ...f, totalGrossSalary: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Libellé simulation (pour sauvegarder)</Label>
              <Input value={simLabel} onChange={(e) => setSimLabel(e.target.value)} placeholder="ex : Budget 2026 scénario A" />
            </div>
          </div>

          {simResult && (
            <div className="mt-2 rounded-lg border border-white/[0.07] p-4 bg-white/[0.02] space-y-3">
              <p className="text-sm font-semibold text-white/80 mb-2">Résultats de la simulation</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-white/[0.04] rounded p-3">
                  <p className="text-xs text-white/40 mb-1">TVA nette à verser</p>
                  <p className="font-semibold text-white">{formatFCFA(simResult.tva.net)}</p>
                  <p className="text-xs text-white/30">Collectée {formatFCFA(simResult.tva.collected)} − Déductible {formatFCFA(simResult.tva.deductible)}</p>
                </div>
                <div className="bg-white/[0.04] rounded p-3">
                  <p className="text-xs text-white/40 mb-1">IS / IMF (le plus élevé)</p>
                  <p className="font-semibold text-white">{formatFCFA(simResult.is.payable)}</p>
                  <p className="text-xs text-white/30">IS 27% : {formatFCFA(simResult.is.calculated)} | IMF 1% : {formatFCFA(simResult.is.imf)}</p>
                </div>
                <div className="bg-white/[0.04] rounded p-3">
                  <p className="text-xs text-white/40 mb-1">Patente ({simResult.patente.sector})</p>
                  <p className="font-semibold text-white">{formatFCFA(simResult.patente.amount)}</p>
                </div>
                <div className="bg-white/[0.04] rounded p-3">
                  <p className="text-xs text-white/40 mb-1">CNSS patronal</p>
                  <p className="font-semibold text-white">{formatFCFA(simResult.cnss.employerShare)}</p>
                </div>
                <div className="bg-white/[0.04] rounded p-3">
                  <p className="text-xs text-white/40 mb-1">IRPP estimé (salarial)</p>
                  <p className="font-semibold text-white">{formatFCFA(simResult.irpp.estimated)}</p>
                </div>
                <div className="bg-white/[0.04] rounded p-3">
                  <p className="text-xs text-white/40 mb-1">IPTS</p>
                  <p className="font-semibold text-white">{formatFCFA(simResult.ipts.total)}</p>
                </div>
              </div>
              <div className="bg-primary/10 border border-primary/20 rounded p-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs text-white/50">Charges fiscales (TVA + IS + Patente)</p>
                    <p className="text-lg font-bold text-white">{formatFCFA(simResult.totaux.charges_fiscales)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/50">Taux effectif d'imposition</p>
                    <p className="text-lg font-bold text-primary">{simResult.totaux.effective_rate.toFixed(2)}%</p>
                  </div>
                </div>
                <Separator className="my-2 border-white/[0.07]" />
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Charge totale (fiscal + social)</span>
                  <span className="font-bold text-white">{formatFCFA(simResult.totaux.total)}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowSimulate(false); setSimResult(null); }}>Fermer</Button>
            <Button
              disabled={simulateMut.isPending}
              onClick={() => simulateMut.mutate({
                label: simLabel || undefined,
                fiscalYear: simForm.fiscalYear,
                turnover: Number(simForm.turnover) || 0,
                netProfit: Number(simForm.netProfit) || 0,
                vatDeductible: Number(simForm.vatDeductible) || 0,
                sector: simForm.sector,
                employeeCount: Number(simForm.employeeCount) || 0,
                totalGrossSalary: Number(simForm.totalGrossSalary) || 0,
                save: simSave && !!simLabel,
              })}
            >
              {simulateMut.isPending ? "Calcul…" : "Calculer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialogue : Ajouter obligation ───────────────────────────────── */}
      <Dialog open={showAddObligation} onOpenChange={setShowAddObligation}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle obligation fiscale</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Impôt / Taxe</Label>
              <Select value={obligForm.taxCode} onValueChange={(v) => {
                const found = TAX_CODES.find((t) => t.code === v);
                setObligForm((f) => ({ ...f, taxCode: v, taxLabel: found?.label ?? v }));
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TAX_CODES.map((t) => <SelectItem key={t.code} value={t.code}>{t.code} — {t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Exercice fiscal</Label>
                <Input value={obligForm.fiscalYear} onChange={(e) => setObligForm((f) => ({ ...f, fiscalYear: e.target.value }))} placeholder="2026" />
              </div>
              <div className="space-y-1.5">
                <Label>Période</Label>
                <Input value={obligForm.period} onChange={(e) => setObligForm((f) => ({ ...f, period: e.target.value }))} placeholder="2026-06" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Libellé période</Label>
              <Input value={obligForm.periodLabel} onChange={(e) => setObligForm((f) => ({ ...f, periodLabel: e.target.value }))} placeholder="Juin 2026" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Montant déclaré (FCFA)</Label>
                <Input type="number" value={obligForm.declaredAmount} onChange={(e) => setObligForm((f) => ({ ...f, declaredAmount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Date limite</Label>
                <Input type="date" value={obligForm.dueDate} onChange={(e) => setObligForm((f) => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddObligation(false)}>Annuler</Button>
            <Button
              disabled={addObligMut.isPending || !obligForm.period || !obligForm.dueDate}
              onClick={() => addObligMut.mutate({
                ...obligForm,
                declaredAmount: obligForm.declaredAmount ? Number(obligForm.declaredAmount) : undefined,
              })}
            >
              {addObligMut.isPending ? "…" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialogue : Enregistrer un paiement ──────────────────────────── */}
      <Dialog open={!!showPayDialog} onOpenChange={(o) => { if (!o) setShowPayDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Enregistrer un paiement</DialogTitle>
          </DialogHeader>
          {showPayDialog && (
            <div className="space-y-3 py-2">
              <div className="rounded bg-white/[0.04] p-3 text-sm">
                <p className="font-medium text-white">{showPayDialog.taxLabel}</p>
                <p className="text-white/50 text-xs">{formatPeriod(showPayDialog.period)} · Solde : {formatFCFA(showPayDialog.balance ?? 0)}</p>
              </div>
              <div className="space-y-1.5">
                <Label>Montant payé (FCFA)</Label>
                <Input type="number" value={payForm.amount} onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Date de paiement</Label>
                  <Input type="date" value={payForm.paymentDate} onChange={(e) => setPayForm((f) => ({ ...f, paymentDate: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Mode</Label>
                  <Select value={payForm.paymentMethod} onValueChange={(v) => setPayForm((f) => ({ ...f, paymentMethod: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="virement">Virement</SelectItem>
                      <SelectItem value="cheque">Chèque</SelectItem>
                      <SelectItem value="especes">Espèces</SelectItem>
                      <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Référence (quittance OTR)</Label>
                <Input value={payForm.referenceNumber} onChange={(e) => setPayForm((f) => ({ ...f, referenceNumber: e.target.value }))} placeholder="ex : QU-2026-001234" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayDialog(null)}>Annuler</Button>
            <Button
              disabled={payMut.isPending || !payForm.amount}
              onClick={() => showPayDialog && payMut.mutate({ id: showPayDialog.id, data: payForm })}
            >
              {payMut.isPending ? "…" : "Enregistrer le paiement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
