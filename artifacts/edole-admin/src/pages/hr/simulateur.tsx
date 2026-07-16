/**
 * Simulateur de coût collaborateur — Gaméasù
 * Outil bidirectionnel : Net → Brut / Brut → Net + Scénarios d'impact
 * Barème IRPP Togo, taux configurables, décomposition transparente
 */
import React, { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { HrShell } from "./_layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Calculator, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Banknote, ArrowRight, RefreshCw, Info, ChevronDown, ChevronUp,
  Briefcase, Star, Gift, RotateCcw, UserMinus, BarChart3, Settings2, Eye, EyeOff,
} from "lucide-react";
import { formatFCFA } from "@/lib/format";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface SalaryRates {
  tauxSalarial: number;       // % cotisations salariales (ex: 9)
  tauxPatronal: number;       // % charges patronales (ex: 22.5)
  tauxConges: number;         // % provision congés payés (ex: 10.22)
  abattementFraisPro: number; // % abattement base imposable IRPP (ex: 20)
  reductionParPart: number;   // FCFA/an de réduction par part fiscale (ex: 15000)
  smig: number;               // SMIG mensuel en FCFA (ex: 35000)
}

const DEFAULT_RATES: SalaryRates = {
  tauxSalarial: 9,
  tauxPatronal: 22.5,
  tauxConges: 10.22,
  abattementFraisPro: 28,  // abattement combiné CGI Togo : frais pro 20 % + déductions légales 8 %
  reductionParPart: 15_000,
  smig: 35_000,
};

// Barème IRPP Togo — 8 tranches CGI Togo — annuel en XOF
// Conforme au moteur paie centralisé (payroll-engine.ts)
// Validé : base 1 032 000 FCFA/an → IRPP 330 FCFA/mois ✓
const IRPP_BRACKETS = [
  { up: 900_000,    rate: 0    },
  { up: 1_200_000,  rate: 0.03 },
  { up: 2_500_000,  rate: 0.07 },
  { up: 4_000_000,  rate: 0.11 },
  { up: 6_000_000,  rate: 0.15 },
  { up: 10_000_000, rate: 0.20 },
  { up: 15_000_000, rate: 0.25 },
  { up: Infinity,   rate: 0.30 },
];

interface IrppTranche {
  label: string;
  base: number;
  taux: number;
  montant: number;
}

interface PayrollResult {
  brut: number;
  // Salarial (déductions)
  cotisationsSalariales: number;
  baseImposable: number;
  baseApresAbattement: number;
  irppAnnuel: number;
  irppMensuel: number;
  autresRetenues: number;
  net: number;
  // Employeur
  chargesPatronales: number;
  provisionConges: number;
  coutEmployeurMensuel: number;
  coutEmployeurAnnuel: number;
  // Méta
  convergenceEcart: number;
  alerts: string[];
  irppDetail: IrppTranche[];
}

type SimMode = "net-brut" | "brut-net" | "scenarios";

type ScenarioId = "recrutement" | "augmentation" | "promotion" | "bonus_ponctuel" | "prime_recurrente" | "depart";

// ─────────────────────────────────────────────────────────────────────────────
// MOTEUR FISCAL (fonctions pures)
// ─────────────────────────────────────────────────────────────────────────────

function calcIrpp(revenuAnnuelImposable: number, nbParts: number, reductionParPart: number) {
  const reduction = nbParts * reductionParPart;
  const base = Math.max(0, revenuAnnuelImposable - reduction);
  let tax = 0; let prev = 0;
  const detail: IrppTranche[] = [];
  for (const { up, rate } of IRPP_BRACKETS) {
    if (base <= prev) break;
    const slice = Math.min(base, up === Infinity ? base : up) - prev;
    const sliceTax = Math.round(slice * rate);
    if (slice > 0) {
      detail.push({
        label: up === Infinity ? `Au-delà de ${formatFCFA(prev)}` : `De ${formatFCFA(prev)} à ${formatFCFA(up)}`,
        base: slice,
        taux: rate * 100,
        montant: sliceTax,
      });
    }
    tax += sliceTax;
    prev = up === Infinity ? base : up;
  }
  return { irpp: Math.round(tax), detail };
}

function brutVersNetCalc(brut: number, rates: SalaryRates, nbParts: number): Omit<PayrollResult, "convergenceEcart"> {
  const cotisationsSalariales = Math.round(brut * rates.tauxSalarial / 100);
  // Base imposable mensuelle : floor(Brut × (1-CNSS%) × (1-abattement%) / 1 000) × 1 000
  // Conforme au CGI Togo : abattement combiné 28 % → Brut × 91 % × 72 % arrondi au millier inférieur
  const baseImposable = brut - cotisationsSalariales;  // pour affichage "avant abattement"
  const baseApresAbattement = Math.floor(
    brut * (1 - rates.tauxSalarial / 100) * (1 - rates.abattementFraisPro / 100) / 1000,
  ) * 1000;
  const { irpp: irppAn, detail } = calcIrpp(baseApresAbattement * 12, nbParts, rates.reductionParPart);
  const irppMens = Math.round(irppAn / 12);
  const net = brut - cotisationsSalariales - irppMens;
  const chargesPatronales = Math.round(brut * rates.tauxPatronal / 100);
  const provisionConges = Math.round(brut * rates.tauxConges / 100);
  const coutEmployeurMensuel = brut + chargesPatronales + provisionConges;
  const alerts: string[] = [];
  if (brut < rates.smig) alerts.push(`Salaire brut inférieur au SMIG configuré (${formatFCFA(rates.smig)}/mois).`);
  return {
    brut, cotisationsSalariales, baseImposable, baseApresAbattement,
    irppAnnuel: irppAn, irppMensuel: irppMens, autresRetenues: 0, net,
    chargesPatronales, provisionConges,
    coutEmployeurMensuel, coutEmployeurAnnuel: coutEmployeurMensuel * 12,
    alerts, irppDetail: detail,
  };
}

function netVersBrutCalc(netSouhaite: number, rates: SalaryRates, nbParts: number): PayrollResult {
  // Itération convergente : ajustement amorti pour éviter les oscillations
  let brut = netSouhaite / (1 - rates.tauxSalarial / 100);
  let ecart = 0;
  for (let i = 0; i < 300; i++) {
    const r = brutVersNetCalc(brut, rates, nbParts);
    ecart = netSouhaite - r.net;
    if (Math.abs(ecart) < 0.5) break;
    brut += ecart * 0.9;
  }
  brut = Math.round(brut);
  const result = brutVersNetCalc(brut, rates, nbParts);
  return { ...result, convergenceEcart: Math.abs(netSouhaite - result.net) };
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITAIRES UI
// ─────────────────────────────────────────────────────────────────────────────

function NumInput({ value, onChange, label, hint, min = 0, step = 1000, suffix = "FCFA", disabled = false }: {
  value: number; onChange: (v: number) => void;
  label: string; hint?: string; min?: number; step?: number;
  suffix?: string; disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium">{label}</Label>
      <div className="flex items-center gap-1.5">
        <Input
          type="number" min={min} step={step} disabled={disabled}
          value={value || ""}
          onChange={e => onChange(Number(e.target.value) || 0)}
          className="text-sm h-9 flex-1"
        />
        {suffix && <span className="text-xs text-muted-foreground shrink-0">{suffix}</span>}
      </div>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function RateField({ label, value, onChange, min = 0, max = 100, step = 0.1, suffix = "%" }: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; suffix?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] text-muted-foreground">{label}</Label>
        <Badge variant="secondary" className="text-[10px]">{value}{suffix}</Badge>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} className="h-5" />
    </div>
  );
}

function KpiCard({ label, value, sub, icon: Icon, color, accent = false }: {
  label: string; value: string; sub?: string;
  icon: React.ComponentType<{ className?: string }>; color: string; accent?: boolean;
}) {
  return (
    <Card className={cn("border", accent && "ring-2 ring-primary/20 border-primary/30")}>
      <CardContent className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">{label}</p>
            <p className={cn("text-base font-bold tabular-nums mt-0.5", color)}>{value}</p>
            {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <Icon className={cn("w-4 h-4 shrink-0 mt-1", color)} />
        </div>
      </CardContent>
    </Card>
  );
}

function DecompRow({ label, value, highlight = false, indent = false, sub }: {
  label: string; value: number | string; highlight?: boolean; indent?: boolean; sub?: string;
}) {
  return (
    <div className={cn(
      "flex items-center justify-between py-1.5 text-sm border-b last:border-0",
      highlight && "font-semibold",
      indent && "pl-3 border-l-2 border-muted-foreground/20 ml-2",
    )}>
      <span className={cn("text-xs", highlight ? "text-foreground" : "text-muted-foreground")}>
        {label}
        {sub && <span className="ml-1 text-[10px] text-muted-foreground/70">({sub})</span>}
      </span>
      <span className={cn("tabular-nums text-right text-xs", highlight && "text-base font-bold text-primary")}>
        {typeof value === "number" ? formatFCFA(value) : value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PANNEAU TAUX CONFIGURABLES
// ─────────────────────────────────────────────────────────────────────────────

function RatesPanel({ rates, setRates }: { rates: SalaryRates; setRates: (r: SalaryRates) => void }) {
  const [open, setOpen] = useState(false);
  const set = <K extends keyof SalaryRates>(k: K, v: SalaryRates[K]) => setRates({ ...rates, [k]: v });

  return (
    <Card className="border-dashed">
      <button
        type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-2"><Settings2 className="w-4 h-4" />Taux et paramètres</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <CardContent className="px-4 pb-4 pt-0 space-y-3 border-t">
          <p className="text-[10px] text-muted-foreground pt-2">
            Ces taux sont basés sur la législation Togo / Afrique de l'Ouest (CNSS, IRPP). Modifiez-les selon le pays ou régime applicable.
          </p>
          <RateField label="Cotisations salariales" value={rates.tauxSalarial} onChange={v => set("tauxSalarial", v)} min={0} max={30} />
          <RateField label="Charges patronales" value={rates.tauxPatronal} onChange={v => set("tauxPatronal", v)} min={0} max={50} />
          <RateField label="Provision congés payés" value={rates.tauxConges} onChange={v => set("tauxConges", v)} min={0} max={20} step={0.01} />
          <RateField label="Abattement base imposable IRPP (combiné CGI Togo)" value={rates.abattementFraisPro} onChange={v => set("abattementFraisPro", v)} min={0} max={50} />
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Réduction par part fiscale (FCFA/an)</Label>
            <Input type="number" value={rates.reductionParPart} onChange={e => set("reductionParPart", Number(e.target.value) || 0)} className="h-8 text-xs" step={5000} />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">SMIG mensuel (FCFA)</Label>
            <Input type="number" value={rates.smig} onChange={e => set("smig", Number(e.target.value) || 0)} className="h-8 text-xs" step={5000} />
          </div>
          <button
            type="button" onClick={() => setRates(DEFAULT_RATES)}
            className="text-[10px] text-muted-foreground hover:text-foreground underline"
          >
            Réinitialiser les taux par défaut (Togo)
          </button>
        </CardContent>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PANNEAU RÉSULTATS COMMUN
// ─────────────────────────────────────────────────────────────────────────────

const PIE_COLORS = ["#2563EB", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6"];

function ResultsPanel({ result, mode, avances = 0 }: {
  result: PayrollResult; mode: "net-brut" | "brut-net"; avances?: number;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const netFinal = result.net - avances;

  const pieData = [
    { name: "Net versé", value: Math.max(0, netFinal) },
    { name: "Cotis. salariales", value: result.cotisationsSalariales },
    { name: "IRPP", value: result.irppMensuel },
    { name: "Charges patronales", value: result.chargesPatronales },
    { name: "Prov. congés", value: result.provisionConges },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-4">
      {/* Alertes */}
      {result.alerts.map((a, i) => (
        <div key={i} className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
          {a}
        </div>
      ))}
      {result.convergenceEcart > 1 && (
        <div className="flex items-start gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          Écart de convergence : {formatFCFA(result.convergenceEcart)}. Résultat approché.
        </div>
      )}

      {/* KPI Cards — 2 × 4 */}
      <div className="grid grid-cols-2 gap-2.5">
        <KpiCard label="Salaire net à payer" value={formatFCFA(netFinal)} sub={avances > 0 ? `Après retenue avance ${formatFCFA(avances)}` : "Versé au collaborateur"} icon={Banknote} color="text-emerald-600" accent />
        <KpiCard label="Salaire brut" value={formatFCFA(result.brut)} sub="Base de calcul des charges" icon={Calculator} color="text-primary" />
        <KpiCard label="Cotisations salariales" value={formatFCFA(result.cotisationsSalariales)} sub={`${DEFAULT_RATES.tauxSalarial}% du brut`} icon={TrendingDown} color="text-red-500" />
        <KpiCard label="IRPP mensuel" value={formatFCFA(result.irppMensuel)} sub={`Annuel : ${formatFCFA(result.irppAnnuel)}`} icon={TrendingDown} color="text-orange-500" />
        <KpiCard label="Charges patronales" value={formatFCFA(result.chargesPatronales)} sub="À la charge de l'employeur" icon={TrendingUp} color="text-violet-600" />
        <KpiCard label="Provision congés" value={formatFCFA(result.provisionConges)} sub="30 jours / an" icon={TrendingUp} color="text-cyan-600" />
        <KpiCard label="Coût total / mois" value={formatFCFA(result.coutEmployeurMensuel)} sub="Coût complet employeur" icon={BarChart3} color="text-foreground" accent />
        <KpiCard label="Coût total / an" value={formatFCFA(result.coutEmployeurAnnuel)} sub="Projection 12 mois" icon={BarChart3} color="text-foreground" />
      </div>

      {/* Décomposition détaillée */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Décomposition détaillée</CardTitle>
            <button
              type="button"
              onClick={() => setShowDetail(d => !d)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showDetail ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showDetail ? "Masquer les formules" : "Voir le détail des calculs"}
            </button>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {/* Fiche de paie simplifiée */}
          <div className="space-y-0">
            <DecompRow label="Salaire brut total" value={result.brut} highlight />
            <div className="py-1" />
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Retenues salariales</p>
            <DecompRow
              label="Cotisations salariales"
              value={-result.cotisationsSalariales}
              sub={`${DEFAULT_RATES.tauxSalarial}% × ${formatFCFA(result.brut)}`}
              indent
            />
            <DecompRow
              label="IRPP mensuel"
              value={-result.irppMensuel}
              sub={`${formatFCFA(result.irppAnnuel)}/an ÷ 12`}
              indent
            />
            {avances > 0 && (
              <DecompRow label="Retenue avance sur salaire" value={-avances} indent />
            )}
            <div className="py-1" />
            <DecompRow label="Net à payer" value={netFinal} highlight />
            <div className="py-2" />
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Charges employeur</p>
            <DecompRow label="Salaire brut" value={result.brut} indent />
            <DecompRow
              label="Charges patronales"
              value={result.chargesPatronales}
              sub={`${DEFAULT_RATES.tauxPatronal}% × ${formatFCFA(result.brut)}`}
              indent
            />
            <DecompRow
              label="Provision congés payés"
              value={result.provisionConges}
              sub={`${DEFAULT_RATES.tauxConges}% × ${formatFCFA(result.brut)}`}
              indent
            />
            <div className="py-1" />
            <DecompRow label="Coût total employeur / mois" value={result.coutEmployeurMensuel} highlight />
            <DecompRow label="Coût total employeur / an" value={result.coutEmployeurAnnuel} highlight />
          </div>

          {/* Détail IRPP */}
          {showDetail && (
            <div className="mt-4 pt-3 border-t space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Détail du calcul IRPP</p>
              <div className="bg-muted/40 rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-[10px] text-muted-foreground pb-1 border-b">
                  <span>Tranche</span><span className="text-right">Base</span><span className="text-right">Taux</span><span className="text-right">Montant</span>
                </div>
                <div className="text-[10px] space-y-1">
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-muted-foreground">
                    <span>Brut mensuel</span><span className="text-right tabular-nums">{formatFCFA(result.brut)}</span><span />
                    <span className="text-right tabular-nums text-foreground">{formatFCFA(result.brut)}</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-muted-foreground">
                    <span>− Cotisations salariales</span><span className="text-right tabular-nums">{formatFCFA(result.cotisationsSalariales)}</span><span />
                    <span className="text-right tabular-nums text-red-600">− {formatFCFA(result.cotisationsSalariales)}</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-muted-foreground">
                    <span>Base imposable / mois</span><span className="text-right tabular-nums">{formatFCFA(result.baseImposable)}</span><span />
                    <span className="text-right tabular-nums">{formatFCFA(result.baseImposable)}</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-muted-foreground">
                    <span>Abattement frais pro</span><span className="text-right tabular-nums">{formatFCFA(result.baseImposable - result.baseApresAbattement)}</span><span />
                    <span className="text-right tabular-nums text-red-600">− {formatFCFA(result.baseImposable - result.baseApresAbattement)}</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 font-semibold border-t pt-1">
                    <span>Base nette / mois</span><span /><span />
                    <span className="text-right tabular-nums">{formatFCFA(result.baseApresAbattement)}</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-muted-foreground">
                    <span>Annualisée (× 12)</span><span /><span />
                    <span className="text-right tabular-nums">{formatFCFA(result.baseApresAbattement * 12)}</span>
                  </div>
                </div>
                <div className="border-t pt-2 space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground">Application du barème progressif</p>
                  {result.irppDetail.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground italic">Revenu annuel dans la tranche exonérée (IRPP = 0)</p>
                  ) : result.irppDetail.map((t, i) => (
                    <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-[10px]">
                      <span className="text-muted-foreground">{t.label}</span>
                      <span className="text-right tabular-nums text-muted-foreground">{formatFCFA(t.base)}</span>
                      <span className="text-right text-muted-foreground">{t.taux}%</span>
                      <span className="text-right tabular-nums font-medium">{formatFCFA(t.montant)}</span>
                    </div>
                  ))}
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-[10px] font-semibold border-t pt-1">
                    <span>IRPP annuel</span><span /><span />
                    <span className="text-right tabular-nums">{formatFCFA(result.irppAnnuel)}</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-[10px]">
                    <span className="text-muted-foreground">IRPP mensuel (÷ 12)</span><span /><span />
                    <span className="text-right tabular-nums font-semibold">{formatFCFA(result.irppMensuel)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Graphique répartition */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm">Répartition du coût total employeur</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={65} dataKey="value" stroke="none">
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1.5">
              {pieData.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-xs gap-2">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-muted-foreground">{d.name}</span>
                  </span>
                  <span className="tabular-nums font-medium">{formatFCFA(d.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB A — Net → Brut
// ─────────────────────────────────────────────────────────────────────────────

function NetVersBrutTab() {
  const [net, setNet] = useState(120_000);
  const [nbParts, setNbParts] = useState(1);
  const [avances, setAvances] = useState(0);
  const [rates, setRates] = useState<SalaryRates>(DEFAULT_RATES);

  const result = useMemo(() => netVersBrutCalc(net, rates, nbParts), [net, nbParts, rates]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Panneau gauche */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calculator className="w-4 h-4 text-primary" />
              Paramètres de simulation
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Renseignez le net souhaité : le brut et le coût employeur sont calculés automatiquement.
            </p>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            <NumInput
              label="Salaire net souhaité (FCFA/mois)"
              value={net}
              onChange={setNet}
              step={5_000}
              hint="Montant que le collaborateur doit effectivement percevoir"
            />
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Nombre de parts fiscales</Label>
                <Badge variant="secondary" className="text-[10px]">{nbParts} part{nbParts > 1 ? "s" : ""}</Badge>
              </div>
              <Slider value={[nbParts]} onValueChange={([v]) => setNbParts(v)} min={1} max={10} step={1} />
              <p className="text-[10px] text-muted-foreground">Personnes à charge influençant le calcul de l'IRPP</p>
            </div>
            <NumInput
              label="Avance sur salaire à retenir (FCFA)"
              value={avances}
              onChange={setAvances}
              step={5_000}
              hint="Retenue distincte sur le net à payer (ne modifie pas le brut)"
            />
          </CardContent>
        </Card>
        <RatesPanel rates={rates} setRates={setRates} />
        <div className="bg-muted/40 rounded-lg px-4 py-3 text-[11px] text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">Méthode de calcul</p>
          <p>Le brut est calculé par itération convergente : le système ajuste le brut jusqu'à obtenir un net correspondant exactement au montant demandé, en tenant compte du barème IRPP progressif et du nombre de parts.</p>
        </div>
      </div>

      {/* Panneau droit */}
      <div className="lg:col-span-3">
        <ResultsPanel result={result} mode="net-brut" avances={avances} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB B — Brut → Net
// ─────────────────────────────────────────────────────────────────────────────

function BrutVersNetTab() {
  const [brut, setBrut] = useState(320_000);
  const [nbParts, setNbParts] = useState(1);
  const [avances, setAvances] = useState(0);
  const [rates, setRates] = useState<SalaryRates>(DEFAULT_RATES);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [salaireBase, setSalaireBase] = useState(250_000);
  const [indemnites, setIndemnites] = useState(50_000);
  const [primes, setPrimes] = useState(20_000);

  // Si mode décomposé, brut = somme des éléments
  const brutEffectif = showBreakdown ? salaireBase + indemnites + primes : brut;
  const result = useMemo(() => {
    const r = brutVersNetCalc(brutEffectif, rates, nbParts);
    return { ...r, convergenceEcart: 0 };
  }, [brutEffectif, nbParts, rates]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Panneau gauche */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calculator className="w-4 h-4 text-primary" />
              Rémunération brute
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Mode de saisie</Label>
              <button
                type="button"
                onClick={() => setShowBreakdown(b => !b)}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                {showBreakdown ? "Montant global" : "Décomposer le brut"}
                <ChevronDown className={cn("w-3 h-3 transition-transform", showBreakdown && "rotate-180")} />
              </button>
            </div>

            {!showBreakdown ? (
              <NumInput
                label="Salaire brut total (FCFA/mois)"
                value={brut}
                onChange={setBrut}
                step={5_000}
                hint="Rémunération brute mensuelle complète"
              />
            ) : (
              <div className="space-y-3 bg-muted/30 rounded-lg p-3">
                <NumInput label="Salaire de base" value={salaireBase} onChange={setSalaireBase} step={5_000} />
                <NumInput label="Indemnités (logement, transport…)" value={indemnites} onChange={setIndemnites} step={5_000} />
                <NumInput label="Primes et avantages" value={primes} onChange={setPrimes} step={5_000} />
                <div className="flex items-center justify-between pt-1 border-t text-sm font-semibold">
                  <span>Total brut</span>
                  <span className="text-primary tabular-nums">{formatFCFA(brutEffectif)}</span>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Nombre de parts fiscales</Label>
                <Badge variant="secondary" className="text-[10px]">{nbParts} part{nbParts > 1 ? "s" : ""}</Badge>
              </div>
              <Slider value={[nbParts]} onValueChange={([v]) => setNbParts(v)} min={1} max={10} step={1} />
            </div>

            <NumInput
              label="Avance sur salaire à retenir (FCFA)"
              value={avances}
              onChange={setAvances}
              step={5_000}
              hint="Retenue distincte — n'affecte pas le brut ni les charges"
            />
          </CardContent>
        </Card>
        <RatesPanel rates={rates} setRates={setRates} />
      </div>

      {/* Panneau droit */}
      <div className="lg:col-span-3">
        <ResultsPanel result={result} mode="brut-net" avances={avances} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB C — Scénarios d'impact
// ─────────────────────────────────────────────────────────────────────────────

type ContractType = "cdi" | "cdd" | "stage" | "freelance" | "consultant";

const SCENARIO_DEF: { id: ScenarioId; label: string; icon: React.ComponentType<{ className?: string }>; description: string; color: string }[] = [
  { id: "recrutement",      label: "Nouveau recrutement",      icon: Briefcase,    description: "Coût complet d'un nouveau poste",           color: "border-blue-400 bg-blue-50 text-blue-800" },
  { id: "augmentation",    label: "Augmentation de salaire",  icon: TrendingUp,   description: "Impact d'une hausse de rémunération",       color: "border-emerald-400 bg-emerald-50 text-emerald-800" },
  { id: "promotion",       label: "Promotion",                icon: Star,         description: "Nouveau poste avec nouveau salaire",         color: "border-violet-400 bg-violet-50 text-violet-800" },
  { id: "bonus_ponctuel",  label: "Bonus ponctuel",           icon: Gift,         description: "Impact d'un bonus exceptionnel",             color: "border-amber-400 bg-amber-50 text-amber-800" },
  { id: "prime_recurrente",label: "Prime récurrente",         icon: RotateCcw,    description: "Prime mensuelle ou trimestrielle",           color: "border-cyan-400 bg-cyan-50 text-cyan-800" },
  { id: "depart",          label: "Départ / Remplacement",    icon: UserMinus,    description: "Coût d'un départ et remplacement",          color: "border-red-400 bg-red-50 text-red-800" },
];

const CONTRACT_LABELS: Record<ContractType, string> = {
  cdi: "CDI — Contrat à durée indéterminée",
  cdd: "CDD — Contrat à durée déterminée",
  stage: "Stage",
  freelance: "Freelance / Indépendant",
  consultant: "Consultant externe",
};

interface ScenParams {
  scenario: ScenarioId;
  collaborateurId: string;
  typeContrat: ContractType;
  salaireActuel: number;
  salairePropose: number;
  primesActuelles: number;
  primesProposees: number;
  bonus: number;
  avantages: number;
  coutFormation: number;
  coutEquipement: number;
  coutRecrutement: number;
  moisSimulation: number;
  budgetDisponible: number;
  nbParts: number;
}

function computeScenario(p: ScenParams, rates: SalaryRates) {
  const nbParts = p.nbParts;

  // Situation actuelle
  const actuel = brutVersNetCalc(p.salaireActuel, rates, nbParts);
  const coutActuelMensuel = actuel.coutEmployeurMensuel + p.primesActuelles + p.avantages;
  const coutActuelAnnuel = coutActuelMensuel * 12;

  // Situation proposée
  const baseBrut = (p.scenario === "bonus_ponctuel" || p.scenario === "prime_recurrente" || p.scenario === "depart")
    ? p.salaireActuel : p.salairePropose;

  const propose = brutVersNetCalc(baseBrut, rates, nbParts);
  const primesProp = p.scenario === "prime_recurrente" ? p.primesProposees : p.primesProposees;
  const coutBonus = p.scenario === "bonus_ponctuel" ? Math.round(p.bonus * (1 + rates.tauxPatronal / 100)) : 0;
  const coutOnboarding = (p.scenario === "recrutement" || p.scenario === "depart")
    ? p.coutRecrutement + p.coutFormation + p.coutEquipement : 0;

  const coutProposeMensuel = propose.coutEmployeurMensuel + primesProp + p.avantages;
  const coutProposeAnnuel = coutProposeMensuel * 12 + coutBonus + coutOnboarding;
  const coutPeriode = coutProposeMensuel * p.moisSimulation + coutBonus + coutOnboarding;

  const deltaMensuel = coutProposeMensuel - coutActuelMensuel;
  const deltaAnnuel = coutProposeAnnuel - coutActuelAnnuel;
  const deltaPct = coutActuelAnnuel > 0 ? (deltaAnnuel / coutActuelAnnuel) * 100 : 0;
  const depasseBudget = p.budgetDisponible > 0 && coutPeriode > p.budgetDisponible;

  return {
    actuel, propose,
    coutActuelMensuel, coutActuelAnnuel,
    coutProposeMensuel, coutProposeAnnuel, coutPeriode,
    deltaMensuel, deltaAnnuel, deltaPct,
    depasseBudget, margeOuDepassement: p.budgetDisponible > 0 ? p.budgetDisponible - coutPeriode : 0,
    coutBonus, coutOnboarding,
  };
}

function ScenariosTab() {
  const { data: collaborateursData } = useQuery<any>({
    queryKey: ["hr-collaborateurs-list"],
    queryFn: () => apiFetch("/api/hr/collaborators?limit=200"),
  });
  const collaborateurs = collaborateursData?.data ?? [];

  const [rates, setRates] = useState<SalaryRates>(DEFAULT_RATES);
  const [params, setParams] = useState<ScenParams>({
    scenario: "augmentation",
    collaborateurId: "",
    typeContrat: "cdi",
    salaireActuel: 320_000,
    salairePropose: 400_000,
    primesActuelles: 0,
    primesProposees: 0,
    bonus: 0,
    avantages: 0,
    coutFormation: 0,
    coutEquipement: 0,
    coutRecrutement: 0,
    moisSimulation: 12,
    budgetDisponible: 0,
    nbParts: 1,
  });

  const set = useCallback(<K extends keyof ScenParams>(k: K, v: ScenParams[K]) =>
    setParams(prev => ({ ...prev, [k]: v })), []);

  const result = useMemo(() => computeScenario(params, rates), [params, rates]);

  const scenDef = SCENARIO_DEF.find(s => s.id === params.scenario)!;
  const isRecrutement = params.scenario === "recrutement";
  const isDepart = params.scenario === "depart";
  const isBonus = params.scenario === "bonus_ponctuel";
  const isPrimeRec = params.scenario === "prime_recurrente";
  const needsActuel = !isRecrutement;
  const needsPropose = !isBonus && !isPrimeRec && !isDepart;
  const deltaPositif = result.deltaMensuel >= 0;

  const chartData = [
    { name: "Brut", actuel: params.salaireActuel, propose: result.propose.brut },
    { name: "Charges", actuel: result.actuel.chargesPatronales, propose: result.propose.chargesPatronales },
    { name: "Congés", actuel: result.actuel.provisionConges, propose: result.propose.provisionConges },
    { name: "Primes", actuel: params.primesActuelles, propose: params.primesProposees },
  ].filter(d => d.actuel > 0 || d.propose > 0);

  return (
    <div className="space-y-4">
      {/* Sélecteur de scénario */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {SCENARIO_DEF.map(s => (
          <button
            key={s.id}
            onClick={() => set("scenario", s.id)}
            className={cn(
              "flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 text-center transition-all",
              params.scenario === s.id
                ? s.color + " border-2"
                : "border-border bg-card hover:border-muted-foreground/30",
            )}
          >
            <s.icon className={cn("w-5 h-5", params.scenario !== s.id && "text-muted-foreground")} />
            <span className="text-[11px] font-semibold leading-tight">{s.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Formulaire */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <scenDef.icon className="w-4 h-4 text-primary" />
                {scenDef.label}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{scenDef.description}</p>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">
              {needsActuel && collaborateurs.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Collaborateur (optionnel)</Label>
                  <Select value={params.collaborateurId} onValueChange={id => {
                    const c = collaborateurs.find((x: any) => x.id === id);
                    if (c) {
                      set("collaborateurId", id);
                      if (c.baseSalary) set("salaireActuel", c.baseSalary);
                    }
                  }}>
                    <SelectTrigger className="text-sm h-9"><SelectValue placeholder="Sélectionner ou saisir manuellement…" /></SelectTrigger>
                    <SelectContent>
                      {collaborateurs.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.firstName} {c.lastName}{c.baseSalary ? ` — ${formatFCFA(c.baseSalary)}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs font-medium">Type de contrat</Label>
                <Select value={params.typeContrat} onValueChange={v => set("typeContrat", v as ContractType)}>
                  <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONTRACT_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {needsActuel && (
                <NumInput label={`Salaire brut actuel${isDepart ? " (collaborateur qui part)" : ""} (FCFA/mois)`}
                  value={params.salaireActuel} onChange={v => set("salaireActuel", v)} step={5_000} />
              )}
              {needsPropose && (
                <NumInput label={isRecrutement ? "Salaire brut proposé (FCFA/mois)" : "Nouveau salaire brut (FCFA/mois)"}
                  value={params.salairePropose} onChange={v => set("salairePropose", v)} step={5_000} />
              )}
              {isBonus && (
                <NumInput label="Montant du bonus brut (FCFA)"
                  value={params.bonus} onChange={v => set("bonus", v)} step={10_000}
                  hint="Les charges patronales seront calculées automatiquement" />
              )}
              {isPrimeRec && (
                <NumInput label="Montant de la prime mensuelle (FCFA)"
                  value={params.primesProposees} onChange={v => set("primesProposees", v)} step={5_000} />
              )}

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Parts fiscales</Label>
                  <Badge variant="secondary" className="text-[10px]">{params.nbParts}</Badge>
                </div>
                <Slider value={[params.nbParts]} onValueChange={([v]) => set("nbParts", v)} min={1} max={10} step={1} />
              </div>

              {!isBonus && !isPrimeRec && (
                <>
                  <NumInput label="Primes actuelles (FCFA/mois)" value={params.primesActuelles} onChange={v => set("primesActuelles", v)} step={5_000} />
                  {(isRecrutement || params.scenario === "promotion" || params.scenario === "augmentation") && (
                    <NumInput label="Primes proposées (FCFA/mois)" value={params.primesProposees} onChange={v => set("primesProposees", v)} step={5_000} />
                  )}
                </>
              )}

              <NumInput label="Avantages & bénéfices (FCFA/mois)" value={params.avantages} onChange={v => set("avantages", v)} step={5_000}
                hint="Logement, transport, téléphone, assurance…" />

              {(isRecrutement || isDepart) && (
                <>
                  <Separator />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Coûts d'intégration</p>
                  <NumInput label="Coût de recrutement (FCFA)" value={params.coutRecrutement} onChange={v => set("coutRecrutement", v)} step={10_000} hint="Cabinet, offres d'emploi…" />
                  <NumInput label="Coût de formation (FCFA)" value={params.coutFormation} onChange={v => set("coutFormation", v)} step={5_000} />
                  <NumInput label="Coût d'équipement (FCFA)" value={params.coutEquipement} onChange={v => set("coutEquipement", v)} step={5_000} hint="Ordinateur, téléphone, badges…" />
                </>
              )}

              <Separator />

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Période de simulation</Label>
                  <Badge variant="secondary" className="text-[10px]">{params.moisSimulation} mois</Badge>
                </div>
                <Slider value={[params.moisSimulation]} onValueChange={([v]) => set("moisSimulation", v)} min={1} max={60} step={1} />
              </div>

              <NumInput label="Budget RH disponible (FCFA, 0 = non défini)" value={params.budgetDisponible}
                onChange={v => set("budgetDisponible", v)} step={100_000}
                hint="Laissez 0 pour ignorer la vérification budgétaire" />
            </CardContent>
          </Card>
          <RatesPanel rates={rates} setRates={setRates} />
        </div>

        {/* Résultats scénarios */}
        <div className="lg:col-span-3 space-y-4">
          {/* Alerte budget */}
          {result.depasseBudget && (
            <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
              <AlertTriangle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
              <div>
                <p className="font-semibold">Dépassement budgétaire</p>
                <p className="text-xs mt-0.5">Dépassement de <strong>{formatFCFA(-result.margeOuDepassement)}</strong> ({((-result.margeOuDepassement / params.budgetDisponible) * 100).toFixed(1)}% au-dessus).</p>
              </div>
            </div>
          )}
          {!result.depasseBudget && params.budgetDisponible > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
              <p>Simulation dans le budget — marge de <strong>{formatFCFA(result.margeOuDepassement)}</strong></p>
            </div>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="Coût mensuel simulé" value={formatFCFA(result.coutProposeMensuel)}
              sub={needsActuel ? `Actuel : ${formatFCFA(result.coutActuelMensuel)}` : "Total employeur"}
              icon={Banknote} color="text-primary" accent />
            <KpiCard label="Coût annuel simulé" value={formatFCFA(result.coutProposeAnnuel)}
              sub={needsActuel ? `Actuel : ${formatFCFA(result.coutActuelAnnuel)}` : "Projection 12 mois"}
              icon={BarChart3} color="text-violet-600" />
            <KpiCard label="Impact mensuel"
              value={formatFCFA(Math.abs(result.deltaMensuel))}
              sub={result.deltaMensuel === 0 ? "Aucune variation" : deltaPositif ? "Coût additionnel / mois" : "Économie / mois"}
              icon={deltaPositif ? TrendingUp : TrendingDown}
              color={result.deltaMensuel === 0 ? "text-muted-foreground" : deltaPositif ? "text-amber-600" : "text-emerald-600"} />
            <KpiCard label={`Coût sur ${params.moisSimulation} mois`}
              value={formatFCFA(result.coutPeriode)}
              sub={`Charges inc. : ${formatFCFA(result.propose.chargesPatronales * params.moisSimulation)}`}
              icon={Calculator} color="text-cyan-600" />
          </div>

          {/* Décomposition comparative */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm">Décomposition mensuelle — Actuel vs Simulé</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-2">
                {[
                  { label: "Salaire brut", actuel: params.salaireActuel, propose: result.propose.brut },
                  { label: "Cotisations salariales", actuel: result.actuel.cotisationsSalariales, propose: result.propose.cotisationsSalariales },
                  { label: "IRPP mensuel", actuel: result.actuel.irppMensuel, propose: result.propose.irppMensuel },
                  { label: "Salaire net", actuel: result.actuel.net, propose: result.propose.net },
                  { label: `Charges patronales (${rates.tauxPatronal}%)`, actuel: result.actuel.chargesPatronales, propose: result.propose.chargesPatronales },
                  { label: `Provision congés (${rates.tauxConges}%)`, actuel: result.actuel.provisionConges, propose: result.propose.provisionConges },
                  { label: "Primes mensuelles", actuel: params.primesActuelles, propose: params.primesProposees },
                  { label: "Avantages", actuel: params.avantages, propose: params.avantages },
                ].filter(r => r.actuel > 0 || r.propose > 0).map(row => {
                  const diff = row.propose - row.actuel;
                  return (
                    <div key={row.label} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 text-sm py-1.5 border-b last:border-0">
                      <span className="text-muted-foreground text-xs">{row.label}</span>
                      {needsActuel && <span className="text-right tabular-nums text-xs">{formatFCFA(row.actuel)}</span>}
                      {needsActuel && <ArrowRight className="w-3 h-3 text-muted-foreground/40" />}
                      <span className="text-right tabular-nums font-medium text-xs">{formatFCFA(row.propose)}</span>
                      {needsActuel && diff !== 0 && (
                        <Badge variant="outline" className={cn("text-[9px] ml-auto shrink-0", diff > 0 ? "border-amber-300 text-amber-700" : "border-emerald-300 text-emerald-700")}>
                          {diff > 0 ? "+" : ""}{formatFCFA(diff)}
                        </Badge>
                      )}
                    </div>
                  );
                })}
                {/* Total */}
                <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 pt-2 font-semibold text-sm">
                  <span>Total mensuel employeur</span>
                  {needsActuel && <span className="text-right tabular-nums">{formatFCFA(result.coutActuelMensuel)}</span>}
                  {needsActuel && <ArrowRight className="w-3 h-3 text-muted-foreground/40" />}
                  <span className="text-right tabular-nums text-primary">{formatFCFA(result.coutProposeMensuel)}</span>
                  {needsActuel && result.deltaMensuel !== 0 && (
                    <Badge className={cn("text-[9px]", deltaPositif ? "bg-amber-100 text-amber-800 border-0" : "bg-emerald-100 text-emerald-800 border-0")}>
                      {deltaPositif ? "+" : ""}{formatFCFA(result.deltaMensuel)}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Coûts annexes */}
              {(result.coutBonus > 0 || result.coutOnboarding > 0) && (
                <div className="mt-4 pt-3 border-t space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Coûts non récurrents</p>
                  {result.coutBonus > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Bonus + charges patronales</span>
                      <span className="font-medium tabular-nums">{formatFCFA(result.coutBonus)}</span>
                    </div>
                  )}
                  {result.coutOnboarding > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Recrutement + formation + équipement</span>
                      <span className="font-medium tabular-nums">{formatFCFA(result.coutOnboarding)}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Graphique comparatif */}
          {needsActuel && chartData.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm">Comparaison mensuelle : Actuel vs Simulé</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
                    <Tooltip formatter={(v: number) => formatFCFA(v)} />
                    <Bar dataKey="actuel" name="Actuel" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="propose" name="Simulé" fill="#2563EB" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-4 justify-center mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-400 inline-block" />Actuel</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-600 inline-block" />Simulé</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Résumé */}
          <Card className="bg-muted/30">
            <CardContent className="px-4 py-4">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="text-sm space-y-1">
                  <p className="font-semibold text-foreground">Synthèse</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {params.scenario === "augmentation" && `Hausse de ${formatFCFA(params.salaireActuel)} → ${formatFCFA(params.salairePropose)} brut. Coût mensuel additionnel : ${formatFCFA(result.deltaMensuel)} (${result.deltaPct.toFixed(1)}% de hausse). Net collaborateur : ${formatFCFA(result.actuel.net)} → ${formatFCFA(result.propose.net)}.`}
                    {params.scenario === "recrutement" && `Nouveau poste à ${formatFCFA(result.propose.brut)} brut. Coût mensuel : ${formatFCFA(result.coutProposeMensuel)}.${result.coutOnboarding > 0 ? ` Coûts d'intégration : ${formatFCFA(result.coutOnboarding)}.` : ""} Coût total sur ${params.moisSimulation} mois : ${formatFCFA(result.coutPeriode)}.`}
                    {params.scenario === "promotion" && `Promotion : brut ${formatFCFA(params.salaireActuel)} → ${formatFCFA(params.salairePropose)}. Surcoût mensuel employeur : ${formatFCFA(result.deltaMensuel)}, soit ${formatFCFA(result.deltaAnnuel)} /an.`}
                    {params.scenario === "bonus_ponctuel" && `Bonus brut de ${formatFCFA(params.bonus)} + charges patronales : coût total ${formatFCFA(result.coutBonus)}.`}
                    {params.scenario === "prime_recurrente" && `Prime récurrente de ${formatFCFA(params.primesProposees)}/mois = ${formatFCFA(params.primesProposees * 12)}/an en prime, plus ${formatFCFA(Math.round(params.primesProposees * rates.tauxPatronal / 100) * 12)}/an en charges patronales.`}
                    {params.scenario === "depart" && `Départ libère ${formatFCFA(result.coutActuelMensuel)}/mois.${result.coutOnboarding > 0 ? ` Remplacement : ${formatFCFA(result.coutOnboarding)} de coûts d'intégration.` : ""}`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE PRINCIPALE
// ─────────────────────────────────────────────────────────────────────────────

const MODE_TABS: { id: SimMode; label: string; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
  { id: "net-brut",    label: "Net → Brut",         icon: Calculator,  desc: "Je connais le net souhaité, je veux le brut et le coût employeur" },
  { id: "brut-net",   label: "Brut → Net",          icon: Banknote,    desc: "Je connais le brut, je veux le net et les charges détaillées" },
  { id: "scenarios",  label: "Scénarios d'impact",  icon: BarChart3,   desc: "Recrutement, augmentation, promotion, prime, bonus, départ" },
];

export default function SimulateurPage() {
  const [mode, setMode] = useState<SimMode>("net-brut");

  return (
    <HrShell
      title="Simulateur salarial"
      subtitle="Outil bidirectionnel de simulation — Net↔Brut, coût employeur, IRPP progressif, scénarios d'impact"
      actions={
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <BarChart3 className="w-4 h-4 mr-2" />Exporter
        </Button>
      }
    >
      {/* Sélecteur de mode */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-6">
        {MODE_TABS.map(m => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={cn(
              "flex flex-col items-start gap-1 px-4 py-3 rounded-xl border-2 text-left transition-all",
              mode === m.id
                ? "border-primary bg-primary/5 text-primary"
                : "border-border bg-card hover:border-muted-foreground/40 text-muted-foreground",
            )}
          >
            <span className="flex items-center gap-2 font-semibold text-sm">
              <m.icon className="w-4 h-4" />
              {m.label}
            </span>
            <span className="text-[10px] leading-snug">{m.desc}</span>
          </button>
        ))}
      </div>

      {/* Contenu */}
      {mode === "net-brut"  && <NetVersBrutTab />}
      {mode === "brut-net"  && <BrutVersNetTab />}
      {mode === "scenarios" && <ScenariosTab />}
    </HrShell>
  );
}
