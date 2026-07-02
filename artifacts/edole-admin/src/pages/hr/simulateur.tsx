import React, { useState, useMemo } from "react";
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  Calculator, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Users, Banknote, ArrowRight, Upload, RefreshCw, Info,
  Briefcase, Star, Gift, RotateCcw, UserMinus, BarChart3,
} from "lucide-react";
import { formatFCFA } from "@/lib/format";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type Scenario =
  | "recrutement"
  | "augmentation"
  | "promotion"
  | "bonus_ponctuel"
  | "prime_recurrente"
  | "depart";

type ContractType = "cdi" | "cdd" | "stage" | "freelance" | "consultant";

interface SimParams {
  scenario: Scenario;
  collaborateurId: string;
  poste: string;
  departement: string;
  typeContrat: ContractType;
  // Salaires
  salaireActuel: number;
  salairePropose: number;
  // Charges & extras
  tauxChargesPatronales: number;
  primesActuelles: number;
  primesProposees: number;
  bonus: number;
  avantages: number;
  // Recrutement
  coutFormation: number;
  coutEquipement: number;
  coutRecrutement: number;
  // Période
  moisSimulation: number;
  budgetDisponible: number;
}

interface SimResult {
  // Actuel
  coutTotalMensuelActuel: number;
  coutTotalAnnuelActuel: number;
  // Proposé
  salaireProposeMensuel: number;
  chargesProposeesMensuelles: number;
  primesMensuelles: number;
  coutTotalMensuelPropose: number;
  coutTotalAnnuelPropose: number;
  coutTotalPeriode: number;
  // Delta
  deltaMensuel: number;
  deltaAnnuel: number;
  deltaPct: number;
  // Alertes
  depasseBudget: boolean;
  depassePct: number;
  // Bonus / Recrutement
  coutBonus: number;
  coutOnboarding: number;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const SCENARIOS: { id: Scenario; label: string; icon: React.ComponentType<{ className?: string }>; description: string; color: string }[] = [
  { id: "recrutement",     label: "Nouveau recrutement",     icon: Briefcase,    description: "Coût complet d'un nouveau poste",         color: "border-blue-400 bg-blue-50 text-blue-800" },
  { id: "augmentation",   label: "Augmentation de salaire", icon: TrendingUp,   description: "Impact d'une hausse de rémunération",     color: "border-emerald-400 bg-emerald-50 text-emerald-800" },
  { id: "promotion",      label: "Promotion",               icon: Star,         description: "Nouveau poste avec nouveau salaire",       color: "border-violet-400 bg-violet-50 text-violet-800" },
  { id: "bonus_ponctuel", label: "Bonus ponctuel",          icon: Gift,         description: "Impact d'un bonus exceptionnel",           color: "border-amber-400 bg-amber-50 text-amber-800" },
  { id: "prime_recurrente",label: "Prime récurrente",       icon: RotateCcw,    description: "Prime mensuelle ou trimestrielle",         color: "border-cyan-400 bg-cyan-50 text-cyan-800" },
  { id: "depart",         label: "Départ / Remplacement",   icon: UserMinus,    description: "Coût d'un départ et remplacement",        color: "border-red-400 bg-red-50 text-red-800" },
];

const CONTRACT_LABELS: Record<ContractType, string> = {
  cdi: "CDI — Contrat à durée indéterminée",
  cdd: "CDD — Contrat à durée déterminée",
  stage: "Stage",
  freelance: "Freelance / Indépendant",
  consultant: "Consultant externe",
};

// Taux de charges patronales par défaut (Togo / Afrique de l'Ouest, FCFA)
// CNSS: 16% | Accidents travail: 1% | Formation pro: 1.2% | Médecine: 0.5% ≈ 20%
const DEFAULT_TAUX_CHARGES = 20;

// ── Moteur de calcul ─────────────────────────────────────────────────────────

function calcule(p: SimParams): SimResult {
  const tc = p.tauxChargesPatronales / 100;

  // Situation actuelle
  const chargesActuelles = p.salaireActuel * tc;
  const coutTotalMensuelActuel = p.salaireActuel + chargesActuelles + p.primesActuelles + p.avantages;
  const coutTotalAnnuelActuel = coutTotalMensuelActuel * 12;

  // Situation proposée
  let salaireBase = p.scenario === "bonus_ponctuel" ? p.salaireActuel : p.salairePropose;
  if (p.scenario === "recrutement") salaireBase = p.salairePropose;
  if (p.scenario === "prime_recurrente") salaireBase = p.salaireActuel;

  const chargesProposeesMensuelles = salaireBase * tc;
  let primesMensuelles = p.primesProposees;
  if (p.scenario === "prime_recurrente") primesMensuelles = p.primesProposees;

  const coutBonus = p.scenario === "bonus_ponctuel" ? p.bonus * (1 + tc) : 0;
  const coutOnboarding = p.scenario === "recrutement" || p.scenario === "depart"
    ? p.coutRecrutement + p.coutFormation + p.coutEquipement
    : 0;

  const coutMensuelBase = salaireBase + chargesProposeesMensuelles + primesMensuelles + p.avantages;
  const coutTotalMensuelPropose = coutMensuelBase;
  const coutTotalAnnuelPropose = coutTotalMensuelPropose * 12 + coutBonus + coutOnboarding;
  const coutTotalPeriode = coutTotalMensuelPropose * p.moisSimulation + coutBonus + coutOnboarding;

  const deltaMensuel = coutTotalMensuelPropose - coutTotalMensuelActuel;
  const deltaAnnuel = coutTotalAnnuelPropose - coutTotalAnnuelActuel;
  const deltaPct = coutTotalAnnuelActuel > 0 ? (deltaAnnuel / coutTotalAnnuelActuel) * 100 : 0;

  const depasseBudget = p.budgetDisponible > 0 && coutTotalPeriode > p.budgetDisponible;
  const depassePct = p.budgetDisponible > 0 ? ((coutTotalPeriode - p.budgetDisponible) / p.budgetDisponible) * 100 : 0;

  return {
    coutTotalMensuelActuel,
    coutTotalAnnuelActuel,
    salaireProposeMensuel: salaireBase,
    chargesProposeesMensuelles,
    primesMensuelles,
    coutTotalMensuelPropose,
    coutTotalAnnuelPropose,
    coutTotalPeriode,
    deltaMensuel,
    deltaAnnuel,
    deltaPct,
    depasseBudget,
    depassePct,
    coutBonus,
    coutOnboarding,
  };
}

// ── Utilitaires ───────────────────────────────────────────────────────────────

function Num({ value, onChange, label, hint, min = 0, step = 1000, prefix }: {
  value: number; onChange: (v: number) => void;
  label: string; hint?: string; min?: number; step?: number; prefix?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium">{label}</Label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{prefix}</span>}
        <Input
          type="number" min={min} step={step}
          value={value || ""}
          onChange={e => onChange(Number(e.target.value) || 0)}
          className={cn("text-sm", prefix && "pl-8")}
        />
      </div>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

const PCT_COLORS = { positive: "#10b981", negative: "#ef4444", neutral: "#6366f1" };

// ── Page principale ───────────────────────────────────────────────────────────

export default function SimulateurPage() {
  const { data: collaborateursData } = useQuery<any>({
    queryKey: ["hr-collaborateurs-list"],
    queryFn: () => apiFetch("/api/hr/collaborators?limit=200"),
  });
  const { data: deptsData } = useQuery<any>({
    queryKey: ["hr-depts-list"],
    queryFn: () => apiFetch("/api/hr/departments"),
  });

  const collaborateurs = collaborateursData?.data ?? [];
  const departements = deptsData?.data ?? [];

  const [params, setParams] = useState<SimParams>({
    scenario: "augmentation",
    collaborateurId: "",
    poste: "",
    departement: "",
    typeContrat: "cdi",
    salaireActuel: 320_000,
    salairePropose: 400_000,
    tauxChargesPatronales: DEFAULT_TAUX_CHARGES,
    primesActuelles: 0,
    primesProposees: 0,
    bonus: 0,
    avantages: 0,
    coutFormation: 0,
    coutEquipement: 0,
    coutRecrutement: 0,
    moisSimulation: 12,
    budgetDisponible: 0,
  });

  const set = <K extends keyof SimParams>(k: K, v: SimParams[K]) =>
    setParams(prev => ({ ...prev, [k]: v }));

  const result = useMemo(() => calcule(params), [params]);
  const scenario = SCENARIOS.find(s => s.id === params.scenario)!;

  // Quand on sélectionne un collaborateur, on préremplie le salaire actuel
  const onSelectCollab = (id: string) => {
    const c = collaborateurs.find((x: any) => x.id === id);
    if (c) {
      set("collaborateurId", id);
      if (c.baseSalary) set("salaireActuel", c.baseSalary);
      if (c.departmentId) set("departement", c.departmentId);
      if (c.position) set("poste", c.position);
    }
  };

  // Graphique comparatif
  const chartData = [
    { name: "Salaire", actuel: params.salaireActuel, propose: result.salaireProposeMensuel },
    { name: "Charges", actuel: Math.round(params.salaireActuel * params.tauxChargesPatronales / 100), propose: Math.round(result.chargesProposeesMensuelles) },
    { name: "Primes", actuel: params.primesActuelles, propose: result.primesMensuelles },
    { name: "Avantages", actuel: params.avantages, propose: params.avantages },
  ].filter(d => d.actuel > 0 || d.propose > 0);

  const isNouveauRecrutement = params.scenario === "recrutement";
  const isDepart = params.scenario === "depart";
  const isBonus = params.scenario === "bonus_ponctuel";
  const isPrimeRec = params.scenario === "prime_recurrente";
  const needsActuel = !isNouveauRecrutement;
  const needsPropose = !isBonus && !isPrimeRec && !isDepart;

  const deltaPositif = result.deltaMensuel >= 0;

  const handlePrint = () => window.print();

  return (
    <HrShell
      title="Simulateur de coût collaborateur"
      subtitle="Mesurez l'impact financier de vos décisions RH avant de les prendre"
      actions={
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Upload className="w-4 h-4 mr-2" /> Exporter
        </Button>
      }
    >
      {/* Sélecteur de scénario */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
        {SCENARIOS.map(s => (
          <button
            key={s.id}
            onClick={() => set("scenario", s.id)}
            className={cn(
              "flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 text-center transition-all",
              params.scenario === s.id ? s.color + " border-2" : "border-border bg-card hover:border-muted-foreground/30"
            )}
          >
            <s.icon className={cn("w-5 h-5", params.scenario === s.id ? "" : "text-muted-foreground")} />
            <span className="text-[11px] font-semibold leading-tight">{s.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Panneau gauche : formulaire ── */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <scenario.icon className="w-4 h-4 text-primary" />
                {scenario.label}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{scenario.description}</p>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">

              {/* Collaborateur existant (si applicable) */}
              {needsActuel && collaborateurs.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Collaborateur (optionnel)</Label>
                  <Select value={params.collaborateurId} onValueChange={onSelectCollab}>
                    <SelectTrigger className="text-sm h-9">
                      <SelectValue placeholder="Sélectionner ou saisir manuellement…" />
                    </SelectTrigger>
                    <SelectContent>
                      {collaborateurs.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.firstName} {c.lastName}
                          {c.baseSalary ? ` — ${formatFCFA(c.baseSalary)}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Poste & Département */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Poste</Label>
                  <Input value={params.poste} onChange={e => set("poste", e.target.value)} placeholder="Ex : Comptable" className="text-sm h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Département</Label>
                  {departements.length > 0 ? (
                    <Select value={params.departement} onValueChange={v => set("departement", v)}>
                      <SelectTrigger className="text-sm h-9"><SelectValue placeholder="Département" /></SelectTrigger>
                      <SelectContent>
                        {departements.map((d: any) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={params.departement} onChange={e => set("departement", e.target.value)} placeholder="Ex : Finance" className="text-sm h-9" />
                  )}
                </div>
              </div>

              {/* Type de contrat */}
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

              {/* Salaires */}
              {needsActuel && (
                <Num label="Salaire brut actuel (FCFA/mois)" value={params.salaireActuel}
                  onChange={v => set("salaireActuel", v)} step={5000}
                  hint={isDepart ? "Salaire de la personne qui part" : undefined} />
              )}
              {needsPropose && (
                <Num label={isNouveauRecrutement ? "Salaire brut proposé (FCFA/mois)" : "Nouveau salaire brut (FCFA/mois)"}
                  value={params.salairePropose} onChange={v => set("salairePropose", v)} step={5000} />
              )}
              {isBonus && (
                <Num label="Montant du bonus brut (FCFA)" value={params.bonus}
                  onChange={v => set("bonus", v)} step={10000}
                  hint="Les charges patronales seront calculées automatiquement" />
              )}
              {isPrimeRec && (
                <Num label="Montant de la prime mensuelle (FCFA)" value={params.primesProposees}
                  onChange={v => set("primesProposees", v)} step={5000} />
              )}

              {/* Charges & extras */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Taux charges patronales</Label>
                  <Badge variant="secondary" className="text-[10px]">{params.tauxChargesPatronales}%</Badge>
                </div>
                <Slider
                  value={[params.tauxChargesPatronales]}
                  onValueChange={([v]) => set("tauxChargesPatronales", v)}
                  min={5} max={40} step={0.5}
                  className="mt-1"
                />
                <p className="text-[10px] text-muted-foreground">CNSS + accidents + formation pro. Défaut: 20% (Togo)</p>
              </div>

              {!isBonus && !isPrimeRec && (
                <>
                  <Num label="Primes actuelles (FCFA/mois)" value={params.primesActuelles}
                    onChange={v => set("primesActuelles", v)} step={5000} />
                  {(isNouveauRecrutement || params.scenario === "promotion" || params.scenario === "augmentation") && (
                    <Num label="Primes proposées (FCFA/mois)" value={params.primesProposees}
                      onChange={v => set("primesProposees", v)} step={5000} />
                  )}
                </>
              )}

              <Num label="Avantages & bénéfices (FCFA/mois)" value={params.avantages}
                onChange={v => set("avantages", v)} step={5000}
                hint="Logement, transport, téléphone, assurance…" />

              {/* Coûts de recrutement / onboarding */}
              {(isNouveauRecrutement || isDepart) && (
                <>
                  <Separator />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Coûts d'intégration</p>
                  <Num label="Coût de recrutement (FCFA)" value={params.coutRecrutement}
                    onChange={v => set("coutRecrutement", v)} step={10000}
                    hint="Cabinet de recrutement, offres d'emploi…" />
                  <Num label="Coût de formation (FCFA)" value={params.coutFormation}
                    onChange={v => set("coutFormation", v)} step={5000} />
                  <Num label="Coût d'équipement (FCFA)" value={params.coutEquipement}
                    onChange={v => set("coutEquipement", v)} step={5000}
                    hint="Ordinateur, téléphone, badges…" />
                </>
              )}

              <Separator />

              {/* Période & budget */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Période de simulation</Label>
                  <Badge variant="secondary" className="text-[10px]">{params.moisSimulation} mois</Badge>
                </div>
                <Slider value={[params.moisSimulation]} onValueChange={([v]) => set("moisSimulation", v)} min={1} max={60} step={1} />
              </div>

              <Num label="Budget RH disponible (FCFA, 0 = non défini)" value={params.budgetDisponible}
                onChange={v => set("budgetDisponible", v)} step={100000}
                hint="Laissez 0 pour ignorer la vérification budgétaire" />

              <Button variant="outline" size="sm" className="w-full" onClick={() => setParams(prev => ({
                ...prev, primesActuelles: 0, primesProposees: 0, bonus: 0, avantages: 0,
                coutFormation: 0, coutEquipement: 0, coutRecrutement: 0, budgetDisponible: 0,
              }))}>
                <RefreshCw className="w-3.5 h-3.5 mr-2" /> Réinitialiser les extras
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ── Panneau droit : résultats en temps réel ── */}
        <div className="lg:col-span-3 space-y-4">

          {/* Alerte budget */}
          {result.depasseBudget && (
            <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
              <AlertTriangle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
              <div>
                <p className="font-semibold">Dépassement budgétaire</p>
                <p className="text-xs mt-0.5">Le coût simulé dépasse le budget disponible de <strong>{formatFCFA(result.coutTotalPeriode - params.budgetDisponible)}</strong> ({result.depassePct.toFixed(1)}% au-dessus).</p>
              </div>
            </div>
          )}
          {!result.depasseBudget && params.budgetDisponible > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
              <p>Simulation dans le budget disponible — marge de <strong>{formatFCFA(params.budgetDisponible - result.coutTotalPeriode)}</strong></p>
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-3">
            <KpiCard
              label="Coût mensuel simulé"
              value={formatFCFA(result.coutTotalMensuelPropose)}
              sub={needsActuel ? `Actuel : ${formatFCFA(result.coutTotalMensuelActuel)}` : "Total employeur"}
              icon={Banknote}
              color="text-primary"
            />
            <KpiCard
              label="Coût annuel simulé"
              value={formatFCFA(result.coutTotalAnnuelPropose)}
              sub={needsActuel ? `Actuel : ${formatFCFA(result.coutTotalAnnuelActuel)}` : "Projection 12 mois"}
              icon={BarChart3}
              color="text-violet-600"
            />
            <KpiCard
              label={`Impact mensuel`}
              value={formatFCFA(Math.abs(result.deltaMensuel))}
              sub={result.deltaMensuel === 0 ? "Aucune variation" : deltaPositif ? "Coût additionnel / mois" : "Économie / mois"}
              icon={deltaPositif ? TrendingUp : TrendingDown}
              color={result.deltaMensuel === 0 ? "text-muted-foreground" : deltaPositif ? "text-amber-600" : "text-emerald-600"}
              delta={result.deltaPct}
              positive={!deltaPositif}
            />
            <KpiCard
              label={`Coût sur ${params.moisSimulation} mois`}
              value={formatFCFA(result.coutTotalPeriode)}
              sub={`Dont charges : ${formatFCFA(result.chargesProposeesMensuelles * params.moisSimulation)}`}
              icon={Calculator}
              color="text-cyan-600"
            />
          </div>

          {/* Décomposition détaillée */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm">Décomposition du coût mensuel</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-2">
                {[
                  { label: "Salaire brut", actuel: params.salaireActuel, propose: result.salaireProposeMensuel },
                  { label: `Charges patronales (${params.tauxChargesPatronales}%)`, actuel: Math.round(params.salaireActuel * params.tauxChargesPatronales / 100), propose: Math.round(result.chargesProposeesMensuelles) },
                  { label: "Primes mensuelles", actuel: params.primesActuelles, propose: result.primesMensuelles },
                  { label: "Avantages & bénéfices", actuel: params.avantages, propose: params.avantages },
                ].filter(r => r.actuel > 0 || r.propose > 0).map(row => {
                  const diff = row.propose - row.actuel;
                  return (
                    <div key={row.label} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 text-sm py-1.5 border-b last:border-0">
                      <span className="text-muted-foreground text-xs">{row.label}</span>
                      {needsActuel && <span className="text-right tabular-nums text-xs">{formatFCFA(row.actuel)}</span>}
                      {needsActuel && <ArrowRight className="w-3 h-3 text-muted-foreground/40" />}
                      <span className="text-right tabular-nums font-medium text-xs">{formatFCFA(row.propose)}</span>
                      {needsActuel && diff !== 0 && (
                        <Badge variant="outline" className={cn("text-[9px] ml-auto", diff > 0 ? "border-amber-300 text-amber-700" : "border-emerald-300 text-emerald-700")}>
                          {diff > 0 ? "+" : ""}{formatFCFA(diff)}
                        </Badge>
                      )}
                    </div>
                  );
                })}
                {/* Total */}
                <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 pt-2 font-semibold text-sm">
                  <span>Total mensuel employeur</span>
                  {needsActuel && <span className="text-right tabular-nums">{formatFCFA(result.coutTotalMensuelActuel)}</span>}
                  {needsActuel && <ArrowRight className="w-3 h-3 text-muted-foreground/40" />}
                  <span className="text-right tabular-nums text-primary">{formatFCFA(result.coutTotalMensuelPropose)}</span>
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
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Coûts annexes (non récurrents)</p>
                  {result.coutBonus > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground text-xs">Bonus + charges</span>
                      <span className="font-medium tabular-nums">{formatFCFA(result.coutBonus)}</span>
                    </div>
                  )}
                  {result.coutOnboarding > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground text-xs">Recrutement + formation + équipement</span>
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
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                    <Tooltip formatter={(v: number) => formatFCFA(v)} />
                    <Bar dataKey="actuel" name="Actuel" fill="#94a3b8" radius={[3,3,0,0]} />
                    <Bar dataKey="propose" name="Simulé" fill="#2563EB" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-4 justify-center mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-400 inline-block" />Actuel</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-600 inline-block" />Simulé</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Résumé textuel */}
          <Card className="bg-muted/30">
            <CardContent className="px-4 py-4">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="text-sm space-y-1">
                  <p className="font-semibold text-foreground">Synthèse de la simulation</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {params.scenario === "augmentation" && `Cette augmentation de ${formatFCFA(params.salaireActuel)} → ${formatFCFA(params.salairePropose)} représente un coût mensuel additionnel de ${formatFCFA(result.deltaMensuel)}, soit ${formatFCFA(result.deltaAnnuel)} par an (${result.deltaPct.toFixed(1)}% de hausse du coût total).`}
                    {params.scenario === "recrutement" && `Ce recrutement engendre un coût mensuel récurrent de ${formatFCFA(result.coutTotalMensuelPropose)}${result.coutOnboarding > 0 ? ` et des coûts d'intégration de ${formatFCFA(result.coutOnboarding)}` : ""}. Le coût total sur ${params.moisSimulation} mois est estimé à ${formatFCFA(result.coutTotalPeriode)}.`}
                    {params.scenario === "promotion" && `La promotion entraîne un surcoût mensuel de ${formatFCFA(result.deltaMensuel)}, soit ${formatFCFA(result.deltaAnnuel)} annuels supplémentaires.`}
                    {params.scenario === "bonus_ponctuel" && `Ce bonus exceptionnel de ${formatFCFA(params.bonus)} représente un coût total de ${formatFCFA(result.coutBonus)} (bonus + charges patronales de ${params.tauxChargesPatronales}%).`}
                    {params.scenario === "prime_recurrente" && `Cette prime récurrente de ${formatFCFA(params.primesProposees)}/mois représente ${formatFCFA(params.primesProposees * 12)} par an en salaire et ${formatFCFA(Math.round(params.primesProposees * params.tauxChargesPatronales / 100) * 12)} en charges additionnelles.`}
                    {params.scenario === "depart" && `Le départ de ce collaborateur à ${formatFCFA(params.salaireActuel)}/mois libère ${formatFCFA(result.coutTotalMensuelActuel)}/mois.${result.coutOnboarding > 0 ? ` Le remplacement représentera ${formatFCFA(result.coutOnboarding)} de coûts d'intégration.` : ""}`}
                  </p>
                  {params.budgetDisponible > 0 && (
                    <p className={cn("text-xs font-medium mt-1", result.depasseBudget ? "text-red-600" : "text-emerald-600")}>
                      {result.depasseBudget
                        ? `⚠️ Budget dépassé de ${formatFCFA(result.coutTotalPeriode - params.budgetDisponible)} — examinez les arbitrages possibles.`
                        : `✓ Budget respecté — marge de ${formatFCFA(params.budgetDisponible - result.coutTotalPeriode)}.`}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>

      {/* Rappel légal */}
      <p className="text-[11px] text-muted-foreground mt-4">
        * Les calculs sont indicatifs. Les taux de charges patronales peuvent varier selon le secteur, la convention collective et la législation en vigueur. Consultez votre expert-comptable ou DRH avant toute décision.
      </p>
    </HrShell>
  );
}

// ── Composant KPI Card ────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color, delta, positive }: {
  label: string; value: string; sub?: string;
  icon: React.ComponentType<{ className?: string }>; color: string;
  delta?: number; positive?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center bg-muted/50")}>
          <Icon className={cn("w-4 h-4", color)} />
        </div>
        {delta !== undefined && delta !== 0 && (
          <Badge variant="outline" className={cn("text-[10px]", positive ? "border-emerald-300 text-emerald-700" : "border-amber-300 text-amber-700")}>
            {positive ? "▼" : "▲"} {Math.abs(delta).toFixed(1)}%
          </Badge>
        )}
      </div>
      <div className={cn("text-xl font-bold mt-2 tabular-nums", color)}>{value}</div>
      <div className="text-xs font-medium text-foreground mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}
