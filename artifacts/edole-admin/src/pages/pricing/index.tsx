import React, { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { PieChart, Pie, Cell, Tooltip as RechartTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { formatFCFA } from "@/lib/format";
import {
  Plus, Trash2, Info, FileSignature, ShoppingCart, Upload,
  TrendingUp, CheckCircle2, Package, Truck, Users, Wrench, DollarSign,
  Calculator, Lightbulb, Target, Landmark, AlertTriangle, Shield,
  Building2, Megaphone, Banknote, HardHat, Settings2, ChevronDown, ChevronUp,
  AlertCircle, RefreshCw, ArrowRight, Clock, Percent, Tag, BarChart2,
  ChevronRight, Layers, X, Save, Share2, Copy, Check, FolderOpen,
  GitCompare, Link2, ExternalLink, CloudUpload, Eye, BookOpen,
} from "lucide-react";
import { toast } from "sonner";

const uid = () => crypto.randomUUID().slice(0, 8);

// ─── Types ──────────────────────────────────────────────────────────────────

type CostCategory =
  | "direct" | "purchase" | "logistics" | "tax_input" | "other"
  | "labor"
  | "operational" | "depreciation"
  | "admin"
  | "commercial"
  | "financial"
  | "risk";

type AllocMethod = "fixed" | "pct" | "per_unit";
type MarginMode  = "net" | "gross" | "markup";
type TaxMode     = "on_top" | "included";

interface CostItem {
  id: string;
  label: string;
  category: CostCategory;
  alloc: AllocMethod;
  amount: number;           // FCFA fixe | taux % | coût unitaire (FCFA/h, /j, /u)
  qty?: number;             // heures / jours / unités (pour per_unit)
  qtyUnit?: string;         // "h" | "j" | "u" pour affichage
  baseRef?: "cost" | "ht"; // base de calcul pour pct
  notes?: string;
}

interface LaborLineItem {
  id: string;
  name: string;
  collaboratorId?: string;
  contractType: string;
  monthlySalaryBrut: number;
  employerChargeRate: number;
  benefitsMonthly: number;
  weeklyHours: number;
  allocatedHours: number;
}

interface LaborSettings {
  employerChargeRate: number;
  weeklyHours: number;
}

// Unified structure cost config (replaces 4 separate burn rate configs)
interface StructureSectionBudget {
  monthlyBudget: number;  // budget mensuel réel FCFA
}

type BurnRatePeriod = "3m" | "6m" | "12m" | "ytd";

const BURN_RATE_PERIOD_LABELS: Record<BurnRatePeriod, string> = {
  "3m":  "3 derniers mois",
  "6m":  "6 derniers mois",
  "12m": "12 derniers mois",
  "ytd": "Depuis début d'année (YTD)",
};

type DealType = "vente_produit" | "stock" | "service" | "projet" | "location" | "contrat" | "mixte" | "autre";
type DealDurationUnit = "heures" | "jours" | "semaines" | "mois";

const DEAL_TYPE_META: Record<DealType, {
  label: string; icon: string; hint: string;
  defaultUnit: DealDurationUnit; defaultDuration: number;
}> = {
  vente_produit: { label: "Vente de produit",       icon: "🛍️",  hint: "Vente d'un produit physique ou numérique. Les frais indirects sont alloués au prorata de la durée de traitement.", defaultUnit: "jours",    defaultDuration: 1 },
  stock:         { label: "Produit en stock",        icon: "📦",  hint: "Vente depuis le stock existant. Calcul basé sur le coût moyen pondéré + frais de distribution.",                   defaultUnit: "jours",    defaultDuration: 1 },
  service:       { label: "Service ponctuel",        icon: "🔧",  hint: "Prestation unique. La durée réelle en jours détermine la quote-part des frais de structure.",                      defaultUnit: "jours",    defaultDuration: 5 },
  projet:        { label: "Projet unique",           icon: "🏗️", hint: "Projet avec début et fin définis. La durée en semaines ou mois détermine l'allocation des frais généraux.",        defaultUnit: "semaines", defaultDuration: 4 },
  location:      { label: "Location / Équipement",  icon: "🚜",  hint: "Location d'équipement. Amortissement + charges d'exploitation alloués sur la durée de location.",                  defaultUnit: "jours",    defaultDuration: 7 },
  contrat:       { label: "Contrat récurrent",       icon: "📄",  hint: "Revenu récurrent mensuel. Burn rate mensuel utilisé comme base de comparaison directe.",                           defaultUnit: "mois",     defaultDuration: 1 },
  mixte:         { label: "Deal mixte",              icon: "🔀",  hint: "Combinaison de produit, service, location… Ajoutez plusieurs lignes avec leur propre logique.",                   defaultUnit: "jours",    defaultDuration: 5 },
  autre:         { label: "Autre / Personnalisé",    icon: "⚙️",  hint: "Type personnalisé. Ajustez manuellement la durée et les paramètres d'allocation.",                                defaultUnit: "mois",     defaultDuration: 1 },
};

const DEAL_DURATION_UNIT_META: Record<DealDurationUnit, { short: string; long: string; perMonth: number }> = {
  heures:   { short: "h",    long: "heures",   perMonth: 160  },
  jours:    { short: "j",    long: "jours",    perMonth: 22   },
  semaines: { short: "sem",  long: "semaines", perMonth: 4.33 },
  mois:     { short: "mois", long: "mois",     perMonth: 1    },
};

function toEffectiveMonths(value: number, unit: DealDurationUnit): number {
  return Math.max(0, value) / DEAL_DURATION_UNIT_META[unit].perMonth;
}

interface StructureCostConfig {
  enabled: boolean;
  // Shared allocation (applied to ALL sections simultaneously)
  allocationMode: "pct" | "capacity";
  dealDurationMonths: number;
  dealAllocationPct: number;     // mode pct: % direct
  monthlyCapacity: number;       // mode capacity: capacité totale mensuelle (fallback si pas de données compta)
  dealConsumption: number;       // mode capacity: part de ce deal
  capacityUnit: string;
  /** Auto-calcule dealConsumption/dealAllocationPct depuis les coûts directs réels */
  autoAllocation: boolean;
  /** Période de calcul du burn rate réel (auto-allocation) */
  burnRatePeriod: BurnRatePeriod;
  /** Unité de la durée du deal (pour l'allocation des frais de structure) */
  dealDurationUnit: DealDurationUnit;
  // Per-section monthly budgets
  operational: StructureSectionBudget;
  admin: StructureSectionBudget;
  commercial: StructureSectionBudget;
  financial: StructureSectionBudget;
}

interface DealComponent {
  id: string;
  label: string;
  dealType: DealType;
  durationValue: number;
  durationUnit: DealDurationUnit;
  costItems: CostItem[];
}

interface DealComponentResult {
  id: string;
  label: string;
  dealType: DealType;
  directCosts: number;
  structureCost: number;
  total: number;
}

interface TaxBracket {
  id: string; label: string; min: number; max: number | null; rate: number;
}

interface CorporateTaxConfig {
  enabled: boolean;
  ytdProfitBeforeTax: number;
  ytdEstimatedTax: number;
  ytdNetProfit: number;
  brackets: TaxBracket[];
}

interface Scenario {
  id: string;
  name: string;
  description: string;
  productName: string;
  clientId?: string;
  category: string;
  unit: string;
  quantity: number;
  period: string;
  dealType?: DealType;
  dealComponents?: DealComponent[];
  costItems: CostItem[];
  laborLines: LaborLineItem[];
  laborSettings: LaborSettings;
  operationalItems: CostItem[];
  adminItems: CostItem[];
  commercialItems: CostItem[];
  financialItems: CostItem[];
  riskItems: CostItem[];
  depreciationItems: CostItem[];
  // Unified structure cost (operational overhead + admin + commercial + financial)
  structureCosts: StructureCostConfig;
  marginMode: MarginMode;
  marginTarget: number;
  taxRate: number;
  taxMode: TaxMode;
  // Remise commerciale (appliquée après le calcul du prix, réduit la marge)
  discountPct: number;
}

interface PricingResult {
  totalCost: number;
  byCategory: Record<CostCategory, number>;
  /** Prix catalogue HT avant remise */
  priceHTBrut: number;
  /** Montant de la remise */
  discountAmount: number;
  /** Prix HT après remise (= prix facturé) */
  priceHT: number;
  priceTTC: number; taxAmount: number;
  unitCost: number; unitHT: number; unitTTC: number;
  grossMargin: number; grossMarginPct: number;
  operatingMargin: number; operatingMarginPct: number;
  profitBeforeTax: number;
  corporateTax: number; effectiveTaxRate: number; marginalTaxRate: number;
  netProfit: number; netMarginPct: number;
  netMargin: number; markupPct: number;
  minimumPriceHT: number; recommendedPriceHT: number;
  breakdownLabels: { label: string; value: number; color: string }[];
  byComponentResult: DealComponentResult[];
}

type RecType = "danger" | "warning" | "success" | "info";
interface Recommendation { type: RecType; title: string; msg: string; }

interface SavedScenarioMeta {
  id: string;
  name: string;
  description?: string | null;
  productName?: string | null;
  clientName?: string | null;
  shareToken: string;
  shareEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

type CatalogCollab = {
  id: string; firstName: string; lastName: string;
  position?: string | null; department?: string | null;
  baseSalary?: string | null; employerChargeRate: string;
  weeklyHours: string; employmentStatus: string;
  transportAllowance?: string | null;
  housingAllowance?: string | null;
  mealAllowance?: string | null;
  otherBenefitsMonthly?: string | null;
};
type CatalogEquipment = { id: string; name: string; code: string; dailyRate: number; categoryName?: string };

// ─── Constants ──────────────────────────────────────────────────────────────

const CATEGORIES: Record<CostCategory, { label: string; icon: React.FC<any>; color: string; bg: string }> = {
  direct:      { label: "Coûts directs",         icon: Package,    color: "#3B82F6", bg: "bg-blue-50" },
  purchase:    { label: "Achats & approv.",       icon: ShoppingCart,color:"#10B981", bg: "bg-emerald-50" },
  logistics:   { label: "Logistique",             icon: Truck,      color: "#F59E0B", bg: "bg-amber-50" },
  tax_input:   { label: "Taxes & droits",         icon: Percent,    color: "#EF4444", bg: "bg-red-50" },
  other:       { label: "Autres frais directs",   icon: DollarSign, color: "#EC4899", bg: "bg-pink-50" },
  labor:       { label: "Main-d'œuvre",           icon: Users,      color: "#8B5CF6", bg: "bg-purple-50" },
  operational: { label: "Charges opérat.",        icon: Wrench,     color: "#0EA5E9", bg: "bg-sky-50" },
  depreciation:{ label: "Amortissements",         icon: HardHat,    color: "#84CC16", bg: "bg-lime-50" },
  admin:       { label: "Admin & structure",      icon: Building2,  color: "#64748B", bg: "bg-slate-50" },
  commercial:  { label: "Frais commerciaux",      icon: Megaphone,  color: "#A855F7", bg: "bg-purple-50" },
  financial:   { label: "Frais financiers",       icon: Banknote,   color: "#EF4444", bg: "bg-red-50" },
  risk:        { label: "Provisions & risques",   icon: Shield,     color: "#F97316", bg: "bg-orange-50" },
};

const ALLOC_LABELS: Record<AllocMethod, string> = {
  fixed:    "Montant fixe",
  pct:      "Pourcentage",
  per_unit: "Par unité (h/j/u)",
};

const MARGIN_MODES: Record<MarginMode, { label: string; desc: string }> = {
  net:    { label: "Marge nette cible",         desc: "% du prix HT restant après tous les coûts" },
  gross:  { label: "Marge brute cible",         desc: "% du prix HT avant charges indirectes" },
  markup: { label: "Coefficient de majoration", desc: "Multiplicateur (ex. 40 = ×1.4 sur le coût)" },
};

const DEFAULT_TAX_BRACKETS: TaxBracket[] = [
  { id: "b1", label: "Exonération",         min: 0,          max: 2_000_000,  rate: 0 },
  { id: "b2", label: "Tranche 1 (2M–10M)",  min: 2_000_001,  max: 10_000_000, rate: 15 },
  { id: "b3", label: "Tranche 2 (10M–50M)", min: 10_000_001, max: 50_000_000, rate: 25 },
  { id: "b4", label: "Tranche supérieure",  min: 50_000_001, max: null,        rate: 29 },
];

const DEFAULT_LABOR: LaborSettings = { employerChargeRate: 18.4, weeklyHours: 40 };

const DEFAULT_STRUCTURE_COSTS: StructureCostConfig = {
  enabled: false,
  allocationMode: "pct",
  dealDurationMonths: 1,
  dealAllocationPct: 0,
  monthlyCapacity: 0,
  dealConsumption: 0,
  capacityUnit: "FCFA",
  autoAllocation: false,
  burnRatePeriod: "ytd",
  dealDurationUnit: "mois",
  operational: { monthlyBudget: 0 },
  admin:        { monthlyBudget: 0 },
  commercial:   { monthlyBudget: 0 },
  financial:    { monthlyBudget: 0 },
};

const DEFAULT_SCENARIO: Scenario = {
  id: "default", name: "Scénario 1", description: "",
  productName: "", clientId: "", category: "", unit: "unité", quantity: 1, period: "",
  costItems: [{ id: uid(), label: "Matériaux / Fournitures", category: "direct", alloc: "fixed", amount: 0 }],
  laborLines: [], laborSettings: { ...DEFAULT_LABOR },
  operationalItems: [], adminItems: [], commercialItems: [],
  financialItems: [], riskItems: [], depreciationItems: [],
  structureCosts: { ...DEFAULT_STRUCTURE_COSTS },
  marginMode: "net", marginTarget: 25, taxRate: 18, taxMode: "on_top",
  discountPct: 0,
};

const STORAGE_KEY = "gameasutech:pricing:scenarios:v1";

const CHART_COLORS = ["#3B82F6","#8B5CF6","#F59E0B","#10B981","#0EA5E9","#64748B","#A855F7","#EF4444","#F97316","#84CC16","#EC4899","#6366F1"];

// ─── Auto-scenarios ─────────────────────────────────────────────────────────

const AUTO_SCENARIOS = [
  { key: "minimum",    label: "Minimum viable", margin: 0,  color: "#EF4444", bg: "bg-red-50",     border: "border-red-200",     text: "text-red-700" },
  { key: "prudent",    label: "Prudent",        margin: 10, color: "#F59E0B", bg: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-700" },
  { key: "recommande", label: "Recommandé",     margin: 25, color: "#10B981", bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700" },
  { key: "premium",    label: "Premium",        margin: 40, color: "#6366F1", bg: "bg-indigo-50",  border: "border-indigo-200",  text: "text-indigo-700" },
];

// ─── Calculation functions ───────────────────────────────────────────────────

function computeStructureCosts(cfg: StructureCostConfig): {
  operational: number; admin: number; commercial: number; financial: number;
  total: number; effectivePct: number;
} {
  const zero = { operational: 0, admin: 0, commercial: 0, financial: 0, total: 0, effectivePct: 0 };
  if (!cfg.enabled) return zero;
  let effectivePct = 0;
  if (cfg.allocationMode === "capacity") {
    effectivePct = cfg.monthlyCapacity > 0
      ? Math.min(100, (cfg.dealConsumption / cfg.monthlyCapacity) * 100)
      : 0;
  } else {
    effectivePct = Math.min(100, Math.max(0, cfg.dealAllocationPct));
  }
  const factor = toEffectiveMonths(cfg.dealDurationMonths, cfg.dealDurationUnit ?? "mois") * (effectivePct / 100);
  const op = cfg.operational.monthlyBudget * factor;
  const adm = cfg.admin.monthlyBudget * factor;
  const com = cfg.commercial.monthlyBudget * factor;
  const fin = cfg.financial.monthlyBudget * factor;
  return { operational: op, admin: adm, commercial: com, financial: fin, total: op + adm + com + fin, effectivePct };
}

// ─── Class 6 burn rate mapping ────────────────────────────────────────────────

type BalanceRow = {
  code: string; label: string; classNum: number;
  totalDebit: number; totalCredit: number; soldDebit: number; soldCredit: number;
};

type RealBurnRates = {
  operational: number; admin: number; commercial: number; financial: number;
  total: number; hasData: boolean;
  /** Raw YTD totals per section (for display) */
  ytdOperational: number; ytdAdmin: number; ytdCommercial: number; ytdFinancial: number;
};

/** Maps SYSCOHADA class 6 balance rows to the 4 structure sections (monthly average). */
function getBurnRateDateRange(
  period: BurnRatePeriod,
  ytdPeriod?: { from?: string; to?: string },
): { from: string; to: string; months: number } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  if (period === "ytd") {
    const from = ytdPeriod?.from ?? `${now.getFullYear()}-01-01`;
    const toDate = ytdPeriod?.to ?? to;
    const start = new Date(from);
    const end = new Date(toDate);
    const months = Math.max(1, Math.round((end.getTime() - start.getTime()) / (30.4375 * 24 * 3600 * 1000)));
    return { from, to: toDate, months };
  }
  const monthsBack = period === "3m" ? 3 : period === "6m" ? 6 : 12;
  const d = new Date(now);
  d.setMonth(d.getMonth() - monthsBack);
  return { from: d.toISOString().slice(0, 10), to, months: monthsBack };
}

function mapClass6ToSections(rows: BalanceRow[], months: number): RealBurnRates {
  const sums = { operational: 0, admin: 0, commercial: 0, financial: 0 };
  for (const r of rows) {
    const net = r.soldDebit; // class 6: normal balance is debit
    if (net <= 0) continue;
    const p3 = r.code.slice(0, 3);
    const p2 = r.code.slice(0, 2);
    // Commercial: 627 (Publicité, marketing, relations publiques)
    if (p3 === "627") { sums.commercial += net; continue; }
    // Financial: 631 (Frais bancaires), 671 (Intérêts), 681 (Dotations amortissements)
    if (p3 === "631" || p3 === "671" || p3 === "681") { sums.financial += net; continue; }
    // Admin: 622 (Loyer), 625 (Assurances), 628 (Télécom), 64x (Impôts/taxes), 66x (Salaires/charges)
    if (p3 === "622" || p3 === "625" || p3 === "628" || p2 === "64" || p2 === "66") { sums.admin += net; continue; }
    // Operational: 60x (Achats), 61x (Transports), 624 (Entretien/maintenance)
    if (p2 === "60" || p2 === "61" || p3 === "624") { sums.operational += net; continue; }
    // Default fallback → admin
    sums.admin += net;
  }
  const m = Math.max(1, months);
  const totalYtd = sums.operational + sums.admin + sums.commercial + sums.financial;
  return {
    operational: Math.round(sums.operational / m),
    admin:        Math.round(sums.admin / m),
    commercial:   Math.round(sums.commercial / m),
    financial:    Math.round(sums.financial / m),
    total:        Math.round(totalYtd / m),
    hasData:      totalYtd > 0,
    ytdOperational: Math.round(sums.operational),
    ytdAdmin:       Math.round(sums.admin),
    ytdCommercial:  Math.round(sums.commercial),
    ytdFinancial:   Math.round(sums.financial),
  };
}

function computeLaborLineCost(line: LaborLineItem) {
  const monthlyHours = (line.weeklyHours * 52) / 12;
  const monthlyCostEmployeur = line.monthlySalaryBrut * (1 + line.employerChargeRate / 100) + line.benefitsMonthly;
  const hourlyRate = monthlyHours > 0 ? monthlyCostEmployeur / monthlyHours : 0;
  return { hourlyRate, totalCost: hourlyRate * line.allocatedHours, monthlyCostEmployeur };
}

function computeItemCost(item: CostItem, baseCost: number, baseHT: number): number {
  if (item.alloc === "fixed")    return Math.max(0, item.amount);
  if (item.alloc === "per_unit") return Math.max(0, item.amount) * Math.max(0, item.qty ?? 0);
  if (item.alloc === "pct") {
    const base = item.baseRef === "ht" ? baseHT : baseCost;
    return Math.max(0, base) * (Math.max(0, item.amount) / 100);
  }
  return 0;
}

function computeTaxOnProfit(profit: number, brackets: TaxBracket[]): number {
  if (profit <= 0) return 0;
  let tax = 0;
  const sorted = [...brackets].sort((a, b) => a.min - b.min);
  for (const b of sorted) {
    if (profit <= b.min) break;
    const upper = b.max === null ? profit : Math.min(profit, b.max);
    tax += (upper - b.min) * (b.rate / 100);
  }
  return tax;
}

function computeCorporateTax(ytdProfit: number, newProfit: number, brackets: TaxBracket[]) {
  const taxBefore = computeTaxOnProfit(Math.max(0, ytdProfit), brackets);
  const taxAfter  = computeTaxOnProfit(Math.max(0, ytdProfit + newProfit), brackets);
  const incrementalTax = Math.max(0, taxAfter - taxBefore);
  const effectiveRate  = newProfit > 0 ? (incrementalTax / newProfit) * 100 : 0;
  const totalProfit = ytdProfit + newProfit;
  const sorted = [...brackets].sort((a, b) => a.min - b.min);
  let marginalRate = sorted[sorted.length - 1]?.rate ?? 0;
  for (const b of sorted) {
    if (totalProfit >= b.min && (b.max === null || totalProfit <= b.max)) { marginalRate = b.rate; break; }
  }
  return { incrementalTax, effectiveRate, marginalRate };
}

function findPriceForNetMargin(totalCost: number, targetPct: number, ytdProfit: number, brackets: TaxBracket[], taxEnabled: boolean): number {
  if (totalCost <= 0) return 0;
  let lo = totalCost, hi = totalCost * 20;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const grossMargin = mid - totalCost;
    const isTax = taxEnabled ? computeCorporateTax(ytdProfit, grossMargin, brackets).incrementalTax : 0;
    const netPct = mid > 0 ? ((grossMargin - isTax) / mid) * 100 : 0;
    if (Math.abs(netPct - targetPct) < 0.01) break;
    if (netPct < targetPct) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Compute recommended price for a given margin mode and target */
function findPriceForMargin(
  totalCost: number, mode: MarginMode, targetPct: number,
  ytdProfit: number, brackets: TaxBracket[], taxEnabled: boolean
): number {
  if (totalCost <= 0) return 0;
  if (mode === "markup") return totalCost * (1 + targetPct / 100);
  if (mode === "gross") return totalCost / Math.max(0.001, 1 - Math.min(targetPct / 100, 0.999));
  // net mode: binary search accounting for IS
  return findPriceForNetMargin(totalCost, targetPct, ytdProfit, brackets, taxEnabled);
}

function calculate(scenario: Scenario, fc: CorporateTaxConfig, burnRateMonthlyTotal?: number): PricingResult {
  const qty = Math.max(1, scenario.quantity);
  const discountPct = Math.max(0, Math.min(100, scenario.discountPct ?? 0));
  const byCategory: Record<CostCategory, number> = {
    direct: 0, purchase: 0, logistics: 0, tax_input: 0, other: 0,
    labor: 0, operational: 0, depreciation: 0,
    admin: 0, commercial: 0, financial: 0, risk: 0,
  };

  // Deal components (mixte mode)
  const dealComponents = scenario.dealComponents ?? [];
  const hasComponents = scenario.dealType === "mixte" && dealComponents.length > 0;
  const byComponentResult: DealComponentResult[] = [];

  // 1. Labor
  let laborTotal = 0;
  for (const line of scenario.laborLines ?? []) {
    const { totalCost } = computeLaborLineCost(line);
    laborTotal += Math.max(0, totalCost);
  }
  byCategory.labor = laborTotal;

  // 2. Direct cost items (fixed + per_unit)
  let baseCost = laborTotal;
  const allDirect = scenario.costItems ?? [];
  for (const item of allDirect.filter(i => i.alloc !== "pct")) {
    const c = computeItemCost(item, 0, 0);
    byCategory[item.category] = (byCategory[item.category] ?? 0) + c;
    baseCost += c;
  }

  // 3. Amortissements (deal-specific, always line items)
  for (const item of (scenario.depreciationItems ?? []).filter(i => i.alloc !== "pct")) {
    const c = computeItemCost(item, 0, 0);
    byCategory.depreciation += c; baseCost += c;
  }

  // 3.5 Component direct costs (mixte mode with components)
  if (hasComponents) {
    for (const comp of dealComponents) {
      for (const item of (comp.costItems ?? []).filter(i => i.alloc !== "pct")) {
        const c = computeItemCost(item, 0, 0);
        byCategory[item.category] = (byCategory[item.category] ?? 0) + c;
        baseCost += c;
      }
    }
  }

  // 4. Structure costs — per-component (mixte) OR unified burn rate OR fallback to line items
  const rawCfg = scenario.structureCosts ?? DEFAULT_STRUCTURE_COSTS;
  const autoDenominator = burnRateMonthlyTotal ?? (rawCfg.monthlyCapacity > 0 ? rawCfg.monthlyCapacity : 0);

  if (hasComponents && rawCfg.enabled) {
    // Per-component: each component uses its own duration for structure allocation
    for (const comp of dealComponents) {
      const compDirectCost = (comp.costItems ?? []).reduce((s, i) => s + computeItemCost(i, 0, 0), 0);
      const compCfg: StructureCostConfig = {
        ...rawCfg,
        dealDurationMonths: comp.durationValue,
        dealDurationUnit: comp.durationUnit,
        ...(rawCfg.autoAllocation && compDirectCost > 0
          ? rawCfg.allocationMode === "capacity"
            ? { dealConsumption: compDirectCost }
            : { dealAllocationPct: autoDenominator > 0
                  ? Math.min(100, (compDirectCost / autoDenominator) * 100)
                  : rawCfg.dealAllocationPct }
          : {}),
      };
      const compSc = computeStructureCosts(compCfg);
      byCategory.operational += compSc.operational; baseCost += compSc.operational;
      byCategory.admin       += compSc.admin;       baseCost += compSc.admin;
      byCategory.commercial  += compSc.commercial;  baseCost += compSc.commercial;
      byCategory.financial   += compSc.financial;   baseCost += compSc.financial;
      byComponentResult.push({
        id: comp.id, label: comp.label, dealType: comp.dealType,
        directCosts: compDirectCost, structureCost: compSc.total,
        total: compDirectCost + compSc.total,
      });
    }
  } else {
    // Standard: unified structure cost computation
    const totalDirectCostsForAuto =
      laborTotal
      + (scenario.costItems ?? []).reduce((s, i) => s + computeItemCost(i, 0, 0), 0)
      + (scenario.operationalItems ?? []).reduce((s, i) => s + computeItemCost(i, 0, 0), 0)
      + (scenario.depreciationItems ?? []).reduce((s, i) => s + computeItemCost(i, 0, 0), 0);
    const effectiveCfg: StructureCostConfig = rawCfg.autoAllocation && rawCfg.enabled && totalDirectCostsForAuto > 0
      ? rawCfg.allocationMode === "capacity"
        ? { ...rawCfg, dealConsumption: totalDirectCostsForAuto }
        : { ...rawCfg, dealAllocationPct: autoDenominator > 0
              ? Math.min(100, (totalDirectCostsForAuto / autoDenominator) * 100)
              : rawCfg.dealAllocationPct }
      : rawCfg;
    const sc = computeStructureCosts(effectiveCfg);
    if (rawCfg.enabled) {
      byCategory.operational += sc.operational; baseCost += sc.operational;
      byCategory.admin       += sc.admin;       baseCost += sc.admin;
      byCategory.commercial  += sc.commercial;  baseCost += sc.commercial;
      byCategory.financial   += sc.financial;   baseCost += sc.financial;
    } else {
      // Detail mode: use individual line items (fixed + per_unit)
      for (const item of (scenario.operationalItems ?? []).filter(i => i.alloc !== "pct")) {
        const c = computeItemCost(item, 0, 0); byCategory.operational += c; baseCost += c;
      }
      for (const item of (scenario.adminItems ?? []).filter(i => i.alloc !== "pct")) {
        const c = computeItemCost(item, 0, 0); byCategory.admin += c; baseCost += c;
      }
      for (const item of (scenario.financialItems ?? []).filter(i => i.alloc !== "pct")) {
        const c = computeItemCost(item, 0, 0); byCategory.financial += c; baseCost += c;
      }
    }
  }

  // 5. Preliminary price (for pct-of-HT items)
  const prelimHT = scenario.marginMode === "markup"
    ? baseCost * (1 + scenario.marginTarget / 100)
    : baseCost / Math.max(0.001, 1 - Math.min(scenario.marginTarget / 100, 0.999));

  // 6. Pct items (detail mode only)
  for (const item of allDirect.filter(i => i.alloc === "pct")) {
    const c = computeItemCost(item, baseCost, prelimHT);
    byCategory[item.category] = (byCategory[item.category] ?? 0) + c;
    baseCost += c;
  }
  if (!(scenario.structureCosts ?? DEFAULT_STRUCTURE_COSTS).enabled) {
    for (const item of (scenario.operationalItems ?? []).filter(i => i.alloc === "pct")) {
      const c = computeItemCost(item, baseCost, prelimHT); byCategory.operational += c; baseCost += c;
    }
    for (const item of (scenario.adminItems ?? []).filter(i => i.alloc === "pct")) {
      const c = computeItemCost(item, baseCost, prelimHT); byCategory.admin += c; baseCost += c;
    }
    for (const item of (scenario.financialItems ?? []).filter(i => i.alloc === "pct")) {
      const c = computeItemCost(item, baseCost, prelimHT); byCategory.financial += c; baseCost += c;
    }
    for (const item of (scenario.commercialItems ?? [])) {
      const c = computeItemCost(item, baseCost, prelimHT); byCategory.commercial += c; baseCost += c;
    }
  }

  // 7. Risk provisions
  for (const item of (scenario.riskItems ?? [])) {
    const c = computeItemCost(item, baseCost, prelimHT);
    byCategory.risk += c; baseCost += c;
  }

  const totalCost = baseCost;

  // 6. Prix catalogue HT (avant remise)
  let priceHTBrut = 0;
  if (scenario.marginMode === "markup") {
    priceHTBrut = totalCost * (1 + scenario.marginTarget / 100);
  } else {
    priceHTBrut = totalCost / Math.max(0.001, 1 - Math.min(scenario.marginTarget / 100, 0.999));
  }

  // 7. Remise commerciale → prix HT facturé
  const discountAmount = priceHTBrut * (discountPct / 100);
  const priceHT = priceHTBrut - discountAmount;

  const taxAmount = scenario.taxMode === "on_top"
    ? priceHT * (scenario.taxRate / 100)
    : priceHT * (scenario.taxRate / (100 + scenario.taxRate));
  const priceTTC = scenario.taxMode === "on_top" ? priceHT + taxAmount : priceHT;
  const grossMargin = priceHT - totalCost;
  const grossMarginPct = priceHT > 0 ? (grossMargin / priceHT) * 100 : 0;
  const markupPct = totalCost > 0 ? (grossMargin / totalCost) * 100 : 0;

  // 8. IS incrémental (calculé sur la marge brute après remise)
  const { incrementalTax, effectiveRate, marginalRate } = fc.enabled
    ? computeCorporateTax(fc.ytdProfitBeforeTax, grossMargin, fc.brackets)
    : { incrementalTax: 0, effectiveRate: 0, marginalRate: 0 };

  const netProfit = grossMargin - incrementalTax;
  const netMarginPct = priceHT > 0 ? (netProfit / priceHT) * 100 : 0;

  // 9. Prix cibles — respectent le marginMode choisi
  const minimumPriceHT     = findPriceForMargin(totalCost, scenario.marginMode, 0,                    fc.ytdProfitBeforeTax, fc.brackets, fc.enabled);
  const recommendedPriceHT = findPriceForMargin(totalCost, scenario.marginMode, scenario.marginTarget, fc.ytdProfitBeforeTax, fc.brackets, fc.enabled);

  // 10. Breakdown for chart (only non-zero categories)
  const breakdownLabels = Object.entries(byCategory)
    .filter(([, v]) => v > 0)
    .map(([k, v], i) => ({
      label: CATEGORIES[k as CostCategory]?.label ?? k,
      value: Math.round(v),
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));

  return {
    totalCost, byCategory, byComponentResult,
    priceHTBrut, discountAmount, priceHT, priceTTC, taxAmount,
    unitCost: totalCost / qty, unitHT: priceHT / qty, unitTTC: priceTTC / qty,
    grossMargin, grossMarginPct,
    operatingMargin: grossMargin, operatingMarginPct: grossMarginPct,
    profitBeforeTax: grossMargin,
    corporateTax: incrementalTax, effectiveTaxRate: effectiveRate, marginalTaxRate: marginalRate,
    netProfit, netMarginPct,
    netMargin: netProfit, markupPct,
    minimumPriceHT, recommendedPriceHT,
    breakdownLabels,
  };
}

// ─── Recommendations ─────────────────────────────────────────────────────────

function generateRecommendations(result: PricingResult, scenario: Scenario, fc: CorporateTaxConfig): Recommendation[] {
  const recs: Recommendation[] = [];
  const { priceHT, totalCost, grossMarginPct, netMarginPct, netProfit, grossMargin, corporateTax, marginalTaxRate, recommendedPriceHT } = result;
  if (totalCost === 0) {
    recs.push({ type: "info", title: "Aucun coût saisi", msg: "Renseignez vos coûts pour obtenir des recommandations." });
    return recs;
  }
  if (priceHT < totalCost) {
    recs.push({ type: "danger", title: "Vente à perte", msg: "Ce prix est inférieur au coût de revient complet. Vous vendez à perte. Augmentez votre prix ou réduisez vos coûts." });
  } else if (grossMarginPct < 5) {
    recs.push({ type: "danger", title: "Marge critique (< 5%)", msg: "La marge sur coût complet est insuffisante pour absorber les aléas et charges non comptabilisées." });
  } else if (grossMarginPct < 15) {
    recs.push({ type: "warning", title: "Marge faible (< 15%)", msg: "Ce prix couvre les coûts mais la marge reste fragile face aux imprévus opérationnels." });
  }
  if (fc.enabled) {
    if (grossMargin > 0 && netProfit <= 0) {
      recs.push({ type: "warning", title: "Rentable avant IS, déficitaire après", msg: "L'impôt société absorbe toute la marge. Augmentez votre prix ou optimisez les coûts déductibles." });
    }
    if (corporateTax > 0 && grossMargin > 0 && (corporateTax / grossMargin) * 100 > 40) {
      recs.push({ type: "warning", title: "Fort impact fiscal", msg: `L'IS absorbe ${((corporateTax / grossMargin) * 100).toFixed(0)}% de votre marge brute. Vérifiez l'éligibilité de vos charges à la déduction.` });
    }
    if (marginalTaxRate > 0) {
      recs.push({ type: "info", title: `Taux marginal IS : ${marginalTaxRate}%`, msg: `Ce deal est imposé au taux marginal de ${marginalTaxRate}%. Toute hausse de prix sera taxée à ce taux.` });
    }
  }
  if (netMarginPct >= scenario.marginTarget && scenario.marginMode === "net") {
    recs.push({ type: "success", title: "Objectif de marge nette atteint ✓", msg: `Ce prix atteint votre marge nette cible de ${scenario.marginTarget}%${fc.enabled ? " après IS" : ""}.` });
  }
  if (recommendedPriceHT > priceHT && priceHT > 0) {
    recs.push({ type: "info", title: "Prix recommandé disponible", msg: `Pour atteindre ${scenario.marginTarget}% de marge nette${fc.enabled ? " après IS" : ""}, appliquez ${formatFCFA(Math.round(recommendedPriceHT))} HT (actuellement ${formatFCFA(Math.round(priceHT))} HT).` });
  }
  if (result.byCategory.risk === 0 && totalCost > 500_000) {
    recs.push({ type: "info", title: "Aucune provision pour risque", msg: "Pour une prestation de cette taille, prévoyez une provision risques (invendus, garanties, impayés) de 2–5%." });
  }
  if (result.byCategory.admin === 0 && totalCost > 1_000_000) {
    recs.push({ type: "info", title: "Charges admin non allouées", msg: "Aucune quote-part de charges admin/structure n'est imputée à ce produit. Vérifiez votre clé d'allocation." });
  }
  if (grossMarginPct > 85) {
    recs.push({ type: "warning", title: "Marge anormalement élevée (> 85%)", msg: "Une marge aussi haute est inhabituelle. Vérifiez que tous les coûts réels sont bien pris en compte." });
  }
  return recs;
}

// ─── CostItemRow ─────────────────────────────────────────────────────────────

function CostItemRow({
  item, onUpdate, onRemove, baseCost, baseHT, showCategory,
}: {
  item: CostItem;
  onUpdate: (u: Partial<CostItem>) => void;
  onRemove: () => void;
  baseCost?: number;
  baseHT?: number;
  showCategory?: boolean;
}) {
  const computed = computeItemCost(item, baseCost ?? 0, baseHT ?? 0);

  return (
    <div className="grid gap-x-2 gap-y-1" style={{ gridTemplateColumns: "1fr 100px 80px 80px 28px" }}>
      <Input
        value={item.label}
        onChange={e => onUpdate({ label: e.target.value })}
        placeholder="Libellé"
        className="h-8 text-xs"
      />
      <Select value={item.alloc} onValueChange={(v) => onUpdate({ alloc: v as AllocMethod })}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="fixed">Fixe (FCFA)</SelectItem>
          <SelectItem value="pct">% coût</SelectItem>
          <SelectItem value="per_unit">Par unité</SelectItem>
        </SelectContent>
      </Select>
      {item.alloc === "pct" ? (
        <div className="relative">
          <Input
            type="number" min="0" max="100" step="any"
            value={item.amount}
            onChange={e => onUpdate({ amount: parseFloat(e.target.value) || 0 })}
            className="h-8 text-xs text-right pr-6"
            placeholder="0"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-medium pointer-events-none">%</span>
        </div>
      ) : (
        <Input
          type="number" min="0" step="any"
          value={item.amount}
          onChange={e => onUpdate({ amount: parseFloat(e.target.value) || 0 })}
          className="h-8 text-xs text-right"
          placeholder="FCFA"
        />
      )}
      {item.alloc === "per_unit" ? (
        <div className="flex gap-1">
          <Input
            type="number" min="0" step="any"
            value={item.qty ?? 0}
            onChange={e => onUpdate({ qty: parseFloat(e.target.value) || 0 })}
            className="h-8 text-xs text-right w-12"
            placeholder="qté"
          />
        </div>
      ) : (
        <div className="h-8 flex items-center text-xs text-right text-emerald-700 font-semibold px-1 truncate">
          {formatFCFA(Math.round(computed))}
        </div>
      )}
      <button onClick={onRemove} className="h-8 w-7 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
      {item.alloc === "per_unit" && (
        <div className="col-span-5 text-xs text-right text-emerald-700 font-semibold pr-8">
          = {formatFCFA(Math.round(computed))} ({item.amount > 0 ? `${formatFCFA(item.amount)} × ${item.qty ?? 0} ${item.qtyUnit ?? "u"}` : "—"})
        </div>
      )}
    </div>
  );
}

// ─── DepreciationItemRow ──────────────────────────────────────────────────────

type DeprExtras = {
  transport: number; install: number; deposit: number;
  maintenance: number; insurance: number;
  purchaseCost: number; lifespanYears: number; residualValue: number;
};

type FixedAssetLight = {
  id: string; code: string; label: string; category?: string | null;
  acquisitionCost: number; residualValue: number; usefulLifeYears: number;
  depreciationMethod: string; status: string; netBookValue: number;
};

function parseDeprNotes(notes?: string): Partial<DeprExtras> {
  try { return JSON.parse(notes ?? "{}"); } catch { return {}; }
}

function DepreciationItemRow({ item, onUpdate, onRemove }: {
  item: CostItem;
  onUpdate: (u: Partial<CostItem>) => void;
  onRemove: () => void;
}) {
  const saved = parseDeprNotes(item.notes);

  const [mode, setMode] = useState<"rental" | "owned">("rental");
  const [showExtras, setShowExtras] = useState(false);

  // Rental extras
  const [transport, setTransport] = useState(saved.transport ?? 0);
  const [install, setInstall]     = useState(saved.install ?? 0);
  const [deposit, setDeposit]     = useState(saved.deposit ?? 0);

  // Owned data
  const [purchaseCost, setPurchaseCost]   = useState(saved.purchaseCost ?? 0);
  const [lifespanYears, setLifespanYears] = useState(saved.lifespanYears ?? 5);
  const [residualValue, setResidualValue] = useState(saved.residualValue ?? 0);
  const [deprMethod, setDeprMethod]       = useState<string>("linear");
  const [maintenance, setMaintenance]     = useState(saved.maintenance ?? 0);
  const [insurance, setInsurance]         = useState(saved.insurance ?? 0);

  // Equipment catalog
  const { data: eqRes } = useQuery<{ data: Array<{ id: string; name: string; code: string; dailyRate: number | null; categoryName?: string }> }>({
    queryKey: ["equipment-depr-picker"],
    queryFn: () => apiFetch("/api/equipment?limit=200"),
    staleTime: 120_000,
  });
  const equipList = eqRes?.data ?? [];

  // Fixed assets (Immobilisations) — for owned mode
  const { data: assetsRes } = useQuery<{ data: FixedAssetLight[] }>({
    queryKey: ["fixed-assets-depr-picker"],
    queryFn: () => apiFetch("/api/accounting/fixed-assets"),
    staleTime: 120_000,
    enabled: mode === "owned",
  });
  const assetList = assetsRes?.data ?? [];

  const lifespanDays    = Math.max(1, Math.round(lifespanYears * 365));
  const depreciable     = Math.max(0, purchaseCost - residualValue);
  const days            = item.qty ?? 0;
  const ownedDailyRate  = depreciable > 0 ? Math.round(depreciable / lifespanDays) : item.amount;
  const baseDailyRate   = mode === "owned" ? ownedDailyRate : item.amount;
  const baseTotal       = baseDailyRate * days;
  const rentalExtras    = transport + install;
  const ownedExtras     = maintenance + insurance;
  const total           = baseTotal + (mode === "rental" ? rentalExtras : ownedExtras);

  const persist = (overrides: Partial<DeprExtras> = {}) => {
    const payload: DeprExtras = { transport, install, deposit, purchaseCost, lifespanYears, residualValue, maintenance, insurance, ...overrides };
    onUpdate({ notes: JSON.stringify(payload) });
  };

  const handleEquipSelect = (equipId: string) => {
    const eq = equipList.find(e => e.id === equipId);
    if (!eq) return;
    const label = `${eq.name} (${eq.code})`;
    if (mode === "rental" && eq.dailyRate) {
      onUpdate({ label, amount: eq.dailyRate });
    } else {
      onUpdate({ label });
    }
  };

  const handleAssetSelect = (assetId: string) => {
    const a = assetList.find(x => x.id === assetId);
    if (!a) return;
    setPurchaseCost(a.acquisitionCost);
    setLifespanYears(a.usefulLifeYears);
    setResidualValue(a.residualValue);
    setDeprMethod(a.depreciationMethod);
    // Single onUpdate call to avoid stale-closure overwrite
    const notesPayload: DeprExtras = {
      transport, install, deposit, maintenance, insurance,
      purchaseCost: a.acquisitionCost,
      lifespanYears: a.usefulLifeYears,
      residualValue: a.residualValue,
    };
    onUpdate({ label: `${a.label} (${a.code})`, notes: JSON.stringify(notesPayload) });
  };

  const handleDays = (v: number) => onUpdate({ qty: v });
  const handleRate = (v: number) => onUpdate({ amount: v });
  const saveOwned  = () => {
    const notesPayload: DeprExtras = { transport, install, deposit, maintenance, insurance, purchaseCost, lifespanYears, residualValue };
    onUpdate({ amount: ownedDailyRate, notes: JSON.stringify(notesPayload) });
  };

  return (
    <div className="border border-lime-100 rounded-lg bg-white p-3 space-y-3">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Input value={item.label} onChange={e => onUpdate({ label: e.target.value })}
          placeholder="Nom de l'équipement…" className="h-8 text-xs flex-1" />
        {total > 0 && <span className="text-xs font-bold text-lime-700 bg-lime-100 px-2 py-0.5 rounded shrink-0">{formatFCFA(Math.round(total))}</span>}
        <button onClick={onRemove} className="h-8 w-7 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Sélecteur contextuel selon le mode */}
      {mode === "rental" && equipList.length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">Importer depuis le catalogue Équipements (optionnel)</p>
          <Select onValueChange={handleEquipSelect}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Choisir un équipement…" /></SelectTrigger>
            <SelectContent position="popper" className="max-h-56 overflow-y-auto">
              {equipList.map(e => (
                <SelectItem key={e.id} value={e.id}>
                  <span className="font-medium">{e.name}</span>
                  <span className="text-muted-foreground ml-1">({e.code})</span>
                  {e.dailyRate ? <span className="text-lime-700 ml-2 text-[10px]">{formatFCFA(e.dailyRate)}/j</span> : null}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {mode === "owned" && (
        <div className="grid grid-cols-1 gap-2">
          {assetList.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">📂 Importer depuis les Immobilisations (auto-remplit les données)</p>
              <Select onValueChange={handleAssetSelect}>
                <SelectTrigger className="h-8 text-xs border-lime-300 bg-lime-50"><SelectValue placeholder="Choisir une immobilisation…" /></SelectTrigger>
                <SelectContent position="popper" className="max-h-56 overflow-y-auto">
                  {assetList.filter(a => a.status === "active").map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="font-medium">{a.label}</span>
                      <span className="text-muted-foreground ml-1 text-[10px]">({a.code})</span>
                      <span className="text-lime-700 ml-2 text-[10px]">{formatFCFA(a.acquisitionCost)}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {equipList.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Ou depuis le catalogue Équipements (nom uniquement)</p>
              <Select onValueChange={handleEquipSelect}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Choisir un équipement…" /></SelectTrigger>
                <SelectContent position="popper" className="max-h-56 overflow-y-auto">
                  {equipList.map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      <span className="font-medium">{e.name}</span>
                      <span className="text-muted-foreground ml-1">({e.code})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {/* Mode toggle */}
      <div className="flex rounded-lg border border-slate-200 overflow-hidden text-[11px] font-medium">
        <button onClick={() => setMode("rental")}
          className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 transition-colors ${mode === "rental" ? "bg-blue-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
          <Truck className="w-3 h-3" /> Vous le louez
        </button>
        <button onClick={() => setMode("owned")}
          className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 transition-colors ${mode === "owned" ? "bg-lime-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
          <HardHat className="w-3 h-3" /> Vous le possédez
        </button>
      </div>

      {/* ── MODE : LOCATION ── */}
      {mode === "rental" && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Prix de location / jour</p>
              <Input type="number" min="0" step="any" value={item.amount || ""}
                onChange={e => handleRate(parseFloat(e.target.value) || 0)}
                className="h-8 text-xs text-right" placeholder="0 FCFA" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Jours d'utilisation</p>
              <Input type="number" min="0" step="1" value={item.qty ?? ""}
                onChange={e => handleDays(parseFloat(e.target.value) || 0)}
                className="h-8 text-xs text-right" placeholder="0" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Sous-total location</p>
              <div className="h-8 flex items-center justify-end px-2.5 text-sm font-bold text-blue-700 bg-blue-50 rounded-md border border-blue-100">
                {baseTotal > 0 ? formatFCFA(Math.round(baseTotal)) : <span className="text-slate-300 text-xs font-normal">—</span>}
              </div>
            </div>
          </div>

          {/* Frais annexes */}
          <div>
            <button onClick={() => setShowExtras(!showExtras)}
              className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-slate-700 transition-colors">
              {showExtras ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showExtras ? "Masquer les frais annexes" : "+ Frais annexes (transport, installation, caution…)"}
            </button>
            {showExtras && (
              <div className="mt-2 space-y-2 pl-2 border-l-2 border-blue-100">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Transport / livraison</p>
                    <Input type="number" min="0" value={transport || ""}
                      onChange={e => { const v = parseFloat(e.target.value) || 0; setTransport(v); persist({ transport: v }); }}
                      className="h-7 text-xs text-right" placeholder="0 FCFA" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Installation / montage</p>
                    <Input type="number" min="0" value={install || ""}
                      onChange={e => { const v = parseFloat(e.target.value) || 0; setInstall(v); persist({ install: v }); }}
                      className="h-7 text-xs text-right" placeholder="0 FCFA" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Caution / dépôt</p>
                    <Input type="number" min="0" value={deposit || ""}
                      onChange={e => { const v = parseFloat(e.target.value) || 0; setDeposit(v); persist({ deposit: v }); }}
                      className="h-7 text-xs text-right" placeholder="0 FCFA" />
                    <p className="text-[9px] text-muted-foreground mt-0.5">Non incluse dans le total</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Total location */}
          {total > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              <div className="flex items-center justify-between text-[10px]">
                <div className="space-y-0.5 text-blue-700">
                  <div>Location : {formatFCFA(item.amount)}/j × {days} j = {formatFCFA(Math.round(baseTotal))}</div>
                  {rentalExtras > 0 && <div>Frais annexes : {formatFCFA(Math.round(rentalExtras))}</div>}
                </div>
                <div className="text-base font-bold text-blue-800">{formatFCFA(Math.round(total))}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MODE : POSSÉDÉ ── */}
      {mode === "owned" && (
        <div className="space-y-2.5">
          {/* Données d'achat — 3 colonnes */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Prix d'achat</p>
              <Input type="number" min="0" value={purchaseCost || ""}
                onChange={e => { const v = parseFloat(e.target.value) || 0; setPurchaseCost(v); persist({ purchaseCost: v }); }}
                className="h-8 text-xs" placeholder="0 FCFA" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Valeur résiduelle</p>
              <Input type="number" min="0" value={residualValue || ""}
                onChange={e => { const v = parseFloat(e.target.value) || 0; setResidualValue(v); persist({ residualValue: v }); }}
                className="h-8 text-xs" placeholder="0 FCFA" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Durée de vie</p>
              <div className="flex gap-1">
                <Input type="number" min="0.5" step="0.5" value={lifespanYears || ""}
                  onChange={e => { const v = parseFloat(e.target.value) || 1; setLifespanYears(v); persist({ lifespanYears: v }); }}
                  className="h-8 text-xs text-right flex-1 min-w-0" placeholder="5" />
                <span className="h-8 flex items-center text-[10px] text-muted-foreground px-1 shrink-0">ans</span>
              </div>
            </div>
          </div>
          <div className="flex gap-1">
            {[1, 2, 5, 10, 20].map(y => (
              <button key={y} onClick={() => { setLifespanYears(y); persist({ lifespanYears: y }); }}
                className={`flex-1 text-[9px] py-0.5 rounded border transition-colors ${lifespanYears === y ? "bg-lime-600 text-white border-lime-600" : "border-slate-200 text-slate-500 hover:border-lime-300 hover:text-lime-700"}`}>
                {y} an{y > 1 ? "s" : ""}
              </button>
            ))}
          </div>

          {/* Coût journalier calculé — avec valeur résiduelle */}
          {purchaseCost > 0 && (
            <div className="bg-lime-50 border border-lime-100 rounded-lg px-3 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calculator className="w-3.5 h-3.5 text-lime-600 shrink-0" />
                  <div className="text-[10px] text-lime-800 space-y-0.5">
                    <div>
                      Amortissable : <strong>{formatFCFA(depreciable)}</strong>
                      {residualValue > 0 && <span className="text-lime-600 ml-1">({formatFCFA(purchaseCost)} − {formatFCFA(residualValue)})</span>}
                    </div>
                    <div>
                      Coût journalier : <strong>{formatFCFA(ownedDailyRate)}/j</strong>
                      <span className="text-lime-600 ml-1">÷ {lifespanDays} j</span>
                      {deprMethod === "linear" && <span className="ml-2 text-[9px] bg-lime-200 text-lime-800 px-1 py-0.5 rounded">Linéaire</span>}
                      {deprMethod === "declining_balance" && <span className="ml-2 text-[9px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded">Dégressif</span>}
                    </div>
                  </div>
                </div>
                <div className="text-[9px] text-lime-600 text-right shrink-0">
                  <div>{formatFCFA(Math.round(ownedDailyRate * 30))}/mois</div>
                  <div>{formatFCFA(Math.round(ownedDailyRate * 365))}/an</div>
                </div>
              </div>
            </div>
          )}

          {/* Frais récurrents */}
          <div>
            <button onClick={() => setShowExtras(!showExtras)}
              className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-slate-700 transition-colors">
              {showExtras ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showExtras ? "Masquer les frais récurrents" : "+ Frais récurrents (maintenance, assurance…)"}
            </button>
            {showExtras && (
              <div className="mt-2 grid grid-cols-2 gap-2 pl-2 border-l-2 border-lime-100">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Maintenance sur ce projet</p>
                  <Input type="number" min="0" value={maintenance || ""}
                    onChange={e => { const v = parseFloat(e.target.value) || 0; setMaintenance(v); persist({ maintenance: v }); }}
                    className="h-7 text-xs text-right" placeholder="0 FCFA" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Assurance sur ce projet</p>
                  <Input type="number" min="0" value={insurance || ""}
                    onChange={e => { const v = parseFloat(e.target.value) || 0; setInsurance(v); persist({ insurance: v }); }}
                    className="h-7 text-xs text-right" placeholder="0 FCFA" />
                </div>
              </div>
            )}
          </div>

          {/* Jours + total */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Jours utilisés sur ce projet</p>
              <Input type="number" min="0" step="1" value={item.qty ?? ""}
                onChange={e => handleDays(parseFloat(e.target.value) || 0)}
                className="h-8 text-xs text-right" placeholder="0" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Coût total imputé</p>
              <div className="h-8 flex items-center justify-end px-2.5 text-sm font-bold text-lime-700 bg-lime-50 rounded-md border border-lime-100">
                {total > 0 ? formatFCFA(Math.round(total)) : <span className="text-slate-300 text-xs font-normal">—</span>}
              </div>
            </div>
          </div>

          {/* Détail total + bouton enregistrer */}
          {total > 0 && (
            <div className="space-y-2">
              <div className="bg-lime-50 border border-lime-100 rounded-lg px-3 py-2">
                <div className="flex items-center justify-between text-[10px]">
                  <div className="space-y-0.5 text-lime-700">
                    <div>Amortissement : {formatFCFA(ownedDailyRate)}/j × {days} j = {formatFCFA(Math.round(baseTotal))}</div>
                    {ownedExtras > 0 && <div>Frais récurrents : {formatFCFA(Math.round(ownedExtras))}</div>}
                  </div>
                  <div className="text-base font-bold text-lime-800">{formatFCFA(Math.round(total))}</div>
                </div>
              </div>
              <Button size="sm" variant="outline" className="w-full h-7 text-xs border-lime-200 text-lime-700 hover:bg-lime-50"
                onClick={saveOwned}>
                Valider et enregistrer dans le calcul
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── LaborLineRow ─────────────────────────────────────────────────────────────

function LaborLineRow({ line, onUpdate, onRemove }: {
  line: LaborLineItem;
  onUpdate: (u: Partial<LaborLineItem>) => void;
  onRemove: () => void;
}) {
  const { hourlyRate, totalCost, monthlyCostEmployeur } = computeLaborLineCost(line);
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-purple-100 rounded-lg bg-purple-50/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-purple-500" />
          <Input
            value={line.name}
            onChange={e => onUpdate({ name: e.target.value })}
            className="h-7 text-sm font-semibold bg-transparent border-0 border-b border-purple-200 rounded-none p-0 w-48 focus-visible:ring-0"
          />
          {line.collaboratorId && <Badge variant="outline" className="text-xs text-purple-700 border-purple-300">Importé</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-purple-700">{formatFCFA(Math.round(totalCost))}</span>
          <button onClick={() => setOpen(!open)} className="text-slate-400 hover:text-slate-600">
            {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button onClick={onRemove} className="text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      {open && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div>
            <Label className="text-xs text-muted-foreground">Salaire brut mensuel (FCFA)</Label>
            <Input type="number" min="0" value={line.monthlySalaryBrut} onChange={e => onUpdate({ monthlySalaryBrut: parseFloat(e.target.value) || 0 })} className="h-7 text-xs mt-0.5" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Charges patronales (%)</Label>
            <Input type="number" min="0" value={line.employerChargeRate} onChange={e => onUpdate({ employerChargeRate: parseFloat(e.target.value) || 0 })} className="h-7 text-xs mt-0.5" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Avantages mensuels (FCFA)</Label>
            <Input type="number" min="0" value={line.benefitsMonthly} onChange={e => onUpdate({ benefitsMonthly: parseFloat(e.target.value) || 0 })} className="h-7 text-xs mt-0.5" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Heures/semaine</Label>
            <Input type="number" min="1" value={line.weeklyHours} onChange={e => onUpdate({ weeklyHours: parseFloat(e.target.value) || 40 })} className="h-7 text-xs mt-0.5" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Heures affectées à ce produit</Label>
            <Input type="number" min="0" value={line.allocatedHours} onChange={e => onUpdate({ allocatedHours: parseFloat(e.target.value) || 0 })} className="h-7 text-xs mt-0.5" />
          </div>
          <div className="bg-purple-50 border border-purple-100 rounded p-2 text-xs space-y-0.5">
            <div className="flex justify-between"><span className="text-muted-foreground">Coût employeur/mois</span><span className="font-semibold">{formatFCFA(Math.round(monthlyCostEmployeur))}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Taux horaire réel</span><span className="font-semibold">{formatFCFA(Math.round(hourlyRate))}/h</span></div>
            <div className="flex justify-between border-t border-purple-100 pt-0.5 mt-0.5"><span className="font-bold text-purple-800">Coût affecté</span><span className="font-bold text-purple-800">{formatFCFA(Math.round(totalCost))}</span></div>
          </div>
        </div>
      )}
      {!open && (
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>Taux horaire : <strong>{formatFCFA(Math.round(hourlyRate))}/h</strong></span>
          <span>Heures : <strong>{line.allocatedHours}h</strong></span>
          <span>Charges : <strong>{line.employerChargeRate}%</strong></span>
        </div>
      )}
    </div>
  );
}

// ─── LoadFromHRDialog ─────────────────────────────────────────────────────────

function LoadFromHRDialog({ open, onClose, onSelect, laborSettings }: {
  open: boolean; onClose: () => void;
  onSelect: (lines: LaborLineItem[]) => void;
  laborSettings: LaborSettings;
}) {
  const { data: collabsRes } = useQuery<{ data: CatalogCollab[] }>({
    queryKey: ["collabs-pricing"], queryFn: () => apiFetch("/api/collaborators?limit=200"), enabled: open,
  });
  const collabs = collabsRes?.data ?? [];
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hours, setHours] = useState<Record<string, number>>({});

  const toggle = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const collabBenefits = (c: CatalogCollab) =>
    (parseFloat(c.transportAllowance ?? "0") || 0) +
    (parseFloat(c.housingAllowance ?? "0") || 0) +
    (parseFloat(c.mealAllowance ?? "0") || 0) +
    (parseFloat(c.otherBenefitsMonthly ?? "0") || 0);

  const handleConfirm = () => {
    const lines: LaborLineItem[] = collabs
      .filter(c => selected.has(c.id))
      .map(c => ({
        id: uid(),
        name: `${c.firstName} ${c.lastName}`,
        collaboratorId: c.id,
        contractType: c.employmentStatus ?? "CDI",
        monthlySalaryBrut: parseFloat(c.baseSalary ?? "0") || 0,
        employerChargeRate: parseFloat(c.employerChargeRate) || laborSettings.employerChargeRate,
        benefitsMonthly: collabBenefits(c),
        weeklyHours: parseFloat(c.weeklyHours) || laborSettings.weeklyHours,
        allocatedHours: hours[c.id] ?? 8,
      }));
    onSelect(lines);
    setSelected(new Set()); setHours({});
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-purple-500" />Importer depuis les Ressources Humaines</DialogTitle>
          <DialogDescription>Sélectionnez les collaborateurs intervenant sur ce produit/service.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {collabs.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Aucun collaborateur trouvé</p>}
          {collabs.map(c => {
            const sel = selected.has(c.id);
            const salary = parseFloat(c.baseSalary ?? "0") || 0;
            const transport = parseFloat(c.transportAllowance ?? "0") || 0;
            const housing  = parseFloat(c.housingAllowance ?? "0") || 0;
            const meal     = parseFloat(c.mealAllowance ?? "0") || 0;
            const other    = parseFloat(c.otherBenefitsMonthly ?? "0") || 0;
            const totalBenefits = transport + housing + meal + other;
            return (
              <div key={c.id} className={`border rounded-lg p-3 cursor-pointer transition-colors ${sel ? "border-purple-300 bg-purple-50" : "border-slate-200 hover:bg-slate-50"}`} onClick={() => toggle(c.id)}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{c.firstName} {c.lastName}</div>
                    <div className="text-xs text-muted-foreground">{c.position ?? "—"} · {c.department ?? "—"}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Salaire brut : <span className="font-semibold">{salary > 0 ? formatFCFA(salary) : "non renseigné"}</span> /mois
                    </div>
                    {totalBenefits > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {transport > 0 && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Transp. {formatFCFA(transport)}</span>}
                        {housing  > 0 && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">Log. {formatFCFA(housing)}</span>}
                        {meal     > 0 && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Repas {formatFCFA(meal)}</span>}
                        {other    > 0 && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">Autres {formatFCFA(other)}</span>}
                        <span className="text-[10px] text-slate-500">= {formatFCFA(totalBenefits)} avantages</span>
                      </div>
                    )}
                  </div>
                  <input type="checkbox" checked={sel} readOnly className="w-4 h-4 ml-2 shrink-0" />
                </div>
                {sel && (
                  <div className="mt-2 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <Label className="text-xs text-purple-700 shrink-0">Heures affectées :</Label>
                    <Input type="number" min="0" value={hours[c.id] ?? 8}
                      onChange={e => setHours(prev => ({ ...prev, [c.id]: parseFloat(e.target.value) || 0 }))}
                      className="h-7 text-xs w-20" />
                    <span className="text-xs text-muted-foreground">h</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleConfirm} disabled={selected.size === 0} className="bg-purple-600 hover:bg-purple-700 text-white">
            Importer {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── LoadFromEquipmentDialog ──────────────────────────────────────────────────

function LoadFromEquipmentDialog({ open, onClose, onSelect }: {
  open: boolean; onClose: () => void;
  onSelect: (items: CostItem[]) => void;
}) {
  const { data: eqRes } = useQuery<{ data: CatalogEquipment[] }>({
    queryKey: ["equipment-pricing"], queryFn: () => apiFetch("/api/equipment?limit=200"), enabled: open,
  });
  const equipment = eqRes?.data ?? [];
  const [days, setDays] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) => { setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); };

  const handleConfirm = () => {
    const items: CostItem[] = equipment.filter(e => selected.has(e.id)).map(e => ({
      id: uid(),
      label: `${e.name} (${e.code})`,
      category: "depreciation" as CostCategory,
      alloc: "per_unit" as AllocMethod,
      amount: e.dailyRate ?? 0,
      qty: days[e.id] ?? 1,
      qtyUnit: "j",
      notes: e.categoryName,
    }));
    onSelect(items); setSelected(new Set()); setDays({}); onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><HardHat className="w-5 h-5 text-lime-600" />Importer depuis les Équipements</DialogTitle>
          <DialogDescription>Sélectionnez les équipements utilisés et le nombre de jours d'usage.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {equipment.length === 0 && (
            <div className="text-center py-8 space-y-2">
              <HardHat className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-sm font-medium text-slate-600">Aucun équipement dans le catalogue</p>
              <p className="text-xs text-muted-foreground">Ajoutez d'abord vos équipements dans le module <strong>Équipements</strong>, puis revenez ici pour les importer.</p>
              <a href="/equipements" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-lime-700 font-medium hover:underline mt-1">
                <ArrowRight className="w-3.5 h-3.5" />Aller au module Équipements
              </a>
            </div>
          )}
          {equipment.map(e => {
            const sel = selected.has(e.id);
            return (
              <div key={e.id} className={`border rounded-lg p-3 cursor-pointer transition-colors ${sel ? "border-lime-300 bg-lime-50" : "border-slate-200 hover:bg-slate-50"}`} onClick={() => toggle(e.id)}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm">{e.name}</div>
                    <div className="text-xs text-muted-foreground">{e.code} · {e.categoryName ?? "—"}</div>
                    <div className="text-xs text-slate-500 mt-0.5">Tarif journalier : {formatFCFA(e.dailyRate ?? 0)}/j</div>
                  </div>
                  <input type="checkbox" checked={sel} readOnly className="w-4 h-4" />
                </div>
                {sel && (
                  <div className="mt-2 flex items-center gap-2" onClick={ev => ev.stopPropagation()}>
                    <Label className="text-xs text-lime-700 shrink-0">Jours d'usage :</Label>
                    <Input type="number" min="0" step="0.5" value={days[e.id] ?? 1}
                      onChange={ev => setDays(prev => ({ ...prev, [e.id]: parseFloat(ev.target.value) || 0 }))}
                      className="h-7 text-xs w-20" />
                    <span className="text-xs text-muted-foreground">j → {formatFCFA((e.dailyRate ?? 0) * (days[e.id] ?? 1))}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleConfirm} disabled={selected.size === 0} className="bg-lime-600 hover:bg-lime-700 text-white">
            Importer {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── LoadFromInventoryDialog ──────────────────────────────────────────────────

type CatalogProduct = {
  id: string; sku: string; name: string; unit: string;
  purchasePriceFcfa: string; sellingPriceFcfa: string;
  stockOnHand: number; isLowStock: boolean;
  categoryId?: string | null; description?: string | null;
};

function LoadFromInventoryDialog({ open, onClose, onSelect }: {
  open: boolean; onClose: () => void;
  onSelect: (items: CostItem[]) => void;
}) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Map<string, { qty: number; price: number }>>(new Map());

  const { data: products = [], isLoading } = useQuery<CatalogProduct[]>({
    queryKey: ["inventory-products-pricing"],
    queryFn: () => apiFetch("/api/inventory/products?limit=500&activeOnly=1"),
    enabled: open,
  });

  const filtered = useMemo(() => {
    if (!q.trim()) return products;
    const lq = q.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(lq) || p.sku.toLowerCase().includes(lq));
  }, [products, q]);

  const toggle = (p: CatalogProduct) => {
    setSelected(prev => {
      const n = new Map(prev);
      if (n.has(p.id)) { n.delete(p.id); }
      else { n.set(p.id, { qty: 1, price: parseFloat(p.purchasePriceFcfa) || 0 }); }
      return n;
    });
  };

  const setQty = (id: string, qty: number) => {
    setSelected(prev => { const n = new Map(prev); const e = n.get(id); if (e) n.set(id, { ...e, qty }); return n; });
  };
  const setPrice = (id: string, price: number) => {
    setSelected(prev => { const n = new Map(prev); const e = n.get(id); if (e) n.set(id, { ...e, price }); return n; });
  };

  const totalSel = selected.size;
  const totalCost = [...selected.values()].reduce((sum, e) => sum + e.price * e.qty, 0);

  const handleConfirm = () => {
    const items: CostItem[] = [];
    for (const [id, { qty, price }] of selected.entries()) {
      const p = products.find(x => x.id === id);
      if (!p) continue;
      items.push({
        id: uid(),
        label: `${p.name} (${p.sku})`,
        category: "purchase",
        alloc: qty !== 1 ? "per_unit" : "fixed",
        amount: qty !== 1 ? price : price * qty,
        qty: qty !== 1 ? qty : undefined,
        qtyUnit: qty !== 1 ? p.unit : undefined,
        notes: p.description ?? undefined,
      });
    }
    onSelect(items);
    setSelected(new Map()); setQ("");
    onClose();
  };

  const handleClose = () => { setSelected(new Map()); setQ(""); onClose(); };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-emerald-600" />
            Importer depuis Produits / Stock
          </DialogTitle>
          <DialogDescription>
            Sélectionnez les produits du catalogue — le prix d'achat est automatiquement renseigné.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="px-6 py-3 border-b shrink-0">
          <div className="relative">
            <Package className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
            <input
              value={q} onChange={e => setQ(e.target.value)}
              placeholder="Rechercher par nom ou SKU…"
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
        </div>

        {/* Product list */}
        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2">
          {isLoading && (
            <div className="text-center py-10 text-muted-foreground text-sm flex flex-col items-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin opacity-50" />Chargement du catalogue…
            </div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-sm">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-20" />
              {q ? "Aucun produit correspondant à votre recherche" : "Aucun produit actif dans le catalogue"}
            </div>
          )}
          {filtered.map(p => {
            const sel = selected.get(p.id);
            const isSel = !!sel;
            const purchasePrice = parseFloat(p.purchasePriceFcfa) || 0;
            return (
              <div key={p.id}
                className={`border rounded-xl p-3 cursor-pointer transition-all ${isSel ? "border-emerald-400 bg-emerald-50 shadow-sm" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}
                onClick={() => toggle(p)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <input type="checkbox" checked={isSel} readOnly className="w-4 h-4 shrink-0 accent-emerald-600 mt-0.5" />
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{p.name}</div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{p.sku}</span>
                        <span className="text-xs text-muted-foreground">Unité : {p.unit}</span>
                        {p.isLowStock && (
                          <span className="text-[10px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <AlertTriangle className="w-3 h-3" />Stock faible ({p.stockOnHand})
                          </span>
                        )}
                        {!p.isLowStock && p.stockOnHand > 0 && (
                          <span className="text-[10px] text-slate-500">Stock : {p.stockOnHand} {p.unit}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-emerald-700">{formatFCFA(purchasePrice)}</div>
                    <div className="text-[10px] text-muted-foreground">/ {p.unit} · prix d'achat</div>
                  </div>
                </div>

                {isSel && (
                  <div className="mt-3 pt-3 border-t border-emerald-200 grid grid-cols-2 gap-3" onClick={e => e.stopPropagation()}>
                    <div>
                      <label className="text-[10px] text-emerald-700 font-semibold uppercase tracking-wide mb-1 block">Quantité ({p.unit})</label>
                      <Input
                        type="number" min="0" step="any"
                        value={sel!.qty}
                        onChange={e => setQty(p.id, parseFloat(e.target.value) || 1)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-emerald-700 font-semibold uppercase tracking-wide mb-1 block">Prix d'achat unitaire (FCFA)</label>
                      <Input
                        type="number" min="0" step="any"
                        value={sel!.price}
                        onChange={e => setPrice(p.id, parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="col-span-2 bg-white rounded-lg border border-emerald-200 px-3 py-1.5 flex justify-between text-xs">
                      <span className="text-muted-foreground">Coût total pour ce produit</span>
                      <span className="font-bold text-emerald-700">{formatFCFA(Math.round(sel!.price * sel!.qty))}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-slate-50 shrink-0">
          {totalSel > 0 && (
            <div className="flex items-center justify-between mb-3 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm">
              <span className="text-emerald-800 font-medium">{totalSel} produit{totalSel > 1 ? "s" : ""} sélectionné{totalSel > 1 ? "s" : ""}</span>
              <span className="font-bold text-emerald-700">Total : {formatFCFA(Math.round(totalCost))}</span>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleClose}>Annuler</Button>
            <Button onClick={handleConfirm} disabled={totalSel === 0} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5">
              <ShoppingCart className="w-4 h-4" />
              Importer {totalSel > 0 ? `${totalSel} produit${totalSel > 1 ? "s" : ""}` : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── SendToDocDialog ──────────────────────────────────────────────────────────

type DocTarget = "proforma" | "order" | "invoice";

function SendToDocDialog({ open, onClose, result, scenario, docType }: {
  open: boolean; onClose: () => void; result: PricingResult; scenario: Scenario; docType: DocTarget;
}) {
  const { data: clientsRes } = useQuery<{ data: { id: string; name: string }[] }>({
    queryKey: ["clients-list"], queryFn: () => apiFetch("/api/clients?limit=100"), enabled: open,
  });
  const clients = clientsRes?.data ?? [];
  const [clientId, setClientId] = useState(scenario.clientId ?? "");
  const [useUnit, setUseUnit] = useState(false);
  const [saving, setSaving] = useState(false);

  const amount = useUnit ? result.unitTTC : result.priceTTC;

  const buildNotes = () => {
    const parts = [
      `[Calculateur tarifaire] ${scenario.productName || "Prestation"}`,
      `Coût de revient : ${formatFCFA(Math.round(result.totalCost))}`,
    ];
    if (result.discountAmount > 0) {
      parts.push(`Prix catalogue : ${formatFCFA(Math.round(result.priceHTBrut))} → Remise ${(scenario.discountPct ?? 0).toFixed(1)}% (−${formatFCFA(Math.round(result.discountAmount))})`);
    }
    parts.push(
      `Prix HT : ${formatFCFA(Math.round(result.priceHT))}`,
      `TVA (${scenario.taxRate}%) : ${formatFCFA(Math.round(result.taxAmount))}`,
      `Prix TTC : ${formatFCFA(Math.round(result.priceTTC))}`,
      `Marge brute : ${result.grossMarginPct.toFixed(1)}%`,
      `Marge nette : ${result.netMarginPct.toFixed(1)}%`,
    );
    if (result.corporateTax > 0) parts.push(`IS incrémental : ${formatFCFA(Math.round(result.corporateTax))}`);
    return parts.join(" · ");
  };

  const handleCreate = async () => {
    if (!clientId) { toast.error("Sélectionnez un client"); return; }
    setSaving(true);
    try {
      const endpoint = docType === "proforma" ? "/api/proformas" : docType === "invoice" ? "/api/invoices" : "/api/orders";
      await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({
          clientId, totalAmount: Math.round(amount), currency: "XOF",
          notes: buildNotes(),
          ...(docType === "invoice" ? { status: "draft", dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) } : {}),
        }),
      });
      const labels: Record<DocTarget, string> = { proforma: "Devis créé", order: "Commande créée", invoice: "Facture créée" };
      toast.success(`${labels[docType]} avec succès`);
      onClose();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); } finally { setSaving(false); }
  };

  const docIcons: Record<DocTarget, React.ReactNode> = {
    proforma: <FileSignature className="w-5 h-5 text-[#2563EB]" />,
    order:    <ShoppingCart className="w-5 h-5 text-[#2563EB]" />,
    invoice:  <Banknote className="w-5 h-5 text-[#2563EB]" />,
  };
  const docTitles: Record<DocTarget, string> = {
    proforma: "Créer un devis", order: "Créer une commande", invoice: "Créer une facture",
  };
  const docBtnLabels: Record<DocTarget, string> = {
    proforma: "Créer le devis", order: "Créer la commande", invoice: "Créer la facture",
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {docIcons[docType]}{docTitles[docType]}
          </DialogTitle>
          <DialogDescription>Les données du calculateur seront reportées dans le document.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-sm">
            <div className="font-semibold">{scenario.productName || "Prestation non nommée"}</div>
            {result.discountAmount > 0 && (
              <div className="flex justify-between text-slate-500 line-through text-xs">
                <span>Prix catalogue HT :</span><span>{formatFCFA(Math.round(result.priceHTBrut))}</span>
              </div>
            )}
            {result.discountAmount > 0 && (
              <div className="flex justify-between text-red-600 text-xs">
                <span>Remise ({(scenario.discountPct ?? 0).toFixed(1)}%) :</span>
                <span>−{formatFCFA(Math.round(result.discountAmount))}</span>
              </div>
            )}
            <div className="flex justify-between"><span className="text-muted-foreground">Prix HT :</span><span className="font-semibold">{formatFCFA(Math.round(result.priceHT))}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">TVA ({scenario.taxRate}%) :</span><span>{formatFCFA(Math.round(result.taxAmount))}</span></div>
            {result.corporateTax > 0 && <div className="flex justify-between text-orange-700"><span>IS incrémental :</span><span className="font-semibold">{formatFCFA(Math.round(result.corporateTax))}</span></div>}
            <div className="flex justify-between border-t pt-1 mt-1"><span className="font-semibold">Prix TTC :</span><span className="font-bold text-[#2563EB]">{formatFCFA(Math.round(result.priceTTC))}</span></div>
          </div>
          <div>
            <Label>Client *</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Sélectionner un client…" /></SelectTrigger>
              <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {scenario.quantity > 1 && (
            <div className="flex gap-2">
              <Button size="sm" variant={!useUnit ? "default" : "outline"} onClick={() => setUseUnit(false)} className={!useUnit ? "bg-[#2563EB] text-white" : ""}>
                Global ({formatFCFA(Math.round(result.priceTTC))})
              </Button>
              <Button size="sm" variant={useUnit ? "default" : "outline"} onClick={() => setUseUnit(true)} className={useUnit ? "bg-[#2563EB] text-white" : ""}>
                Unitaire ({formatFCFA(Math.round(result.unitTTC))})
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button onClick={handleCreate} disabled={saving || !clientId} className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white">{saving ? "Création…" : docBtnLabels[docType]}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── ScenarioCard ─────────────────────────────────────────────────────────────

function ScenarioCard({ def, scenario, fc }: { def: typeof AUTO_SCENARIOS[0]; scenario: Scenario; fc: CorporateTaxConfig }) {
  const sc = { ...scenario, marginTarget: def.margin };
  const r = calculate(sc, fc);
  return (
    <div className={`rounded-xl border ${def.border} ${def.bg} p-4 space-y-2`}>
      <div className={`font-bold text-sm ${def.text}`}>{def.label}</div>
      <div className={`text-2xl font-black ${def.text}`}>{formatFCFA(Math.round(r.priceHT))}<span className="text-xs font-normal ml-1">HT</span></div>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between"><span className="text-muted-foreground">Coût total</span><span className="font-semibold">{formatFCFA(Math.round(r.totalCost))}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Marge brute</span><span className={`font-semibold ${def.text}`}>{r.grossMarginPct.toFixed(1)}%</span></div>
        {fc.enabled && <div className="flex justify-between"><span className="text-muted-foreground">IS incrémental</span><span className="font-semibold text-orange-700">{formatFCFA(Math.round(r.corporateTax))}</span></div>}
        <div className={`flex justify-between font-bold border-t border-current/20 pt-1 ${def.text}`}>
          <span>Marge nette</span><span>{r.netMarginPct.toFixed(1)}%</span>
        </div>
      </div>
      <div className="text-[10px] text-muted-foreground">{formatFCFA(Math.round(r.priceTTC))} TTC</div>
    </div>
  );
}

// ─── CostSection ──────────────────────────────────────────────────────────────

function CostSection({
  title, icon: Icon, color, items, onAdd, onUpdate, onRemove,
  defaultCategory, baseCost, baseHT, children,
  defaultAlloc = "fixed", defaultQtyUnit,
}: {
  title: string; icon: React.FC<any>; color: string;
  items: CostItem[]; onAdd: () => void;
  onUpdate: (id: string, u: Partial<CostItem>) => void;
  onRemove: (id: string) => void;
  defaultCategory: CostCategory;
  baseCost?: number; baseHT?: number;
  children?: React.ReactNode;
  defaultAlloc?: AllocMethod;
  defaultQtyUnit?: string;
}) {
  const total = items.reduce((sum, item) => sum + computeItemCost(item, baseCost ?? 0, baseHT ?? 0), 0);

  return (
    <div className="space-y-2">
      {children}
      <div className="text-[11px] text-slate-500 grid font-medium mb-1" style={{ gridTemplateColumns: "1fr 100px 80px 80px 28px" }}>
        <span>Libellé</span><span>Méthode</span><span className="text-right">Montant</span><span className="text-right">Qté / Total</span><span />
      </div>
      {items.length === 0 ? (
        <div className="text-center py-5 text-muted-foreground text-xs border border-dashed border-slate-200 rounded-lg">
          <Icon className="w-6 h-6 mx-auto mb-1.5 opacity-30" />
          Aucun poste — cliquez « Ajouter »
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map(item => (
            <CostItemRow
              key={item.id} item={item}
              onUpdate={u => onUpdate(item.id, u)}
              onRemove={() => onRemove(item.id)}
              baseCost={baseCost} baseHT={baseHT}
            />
          ))}
          <div className="flex justify-between text-xs border-t border-slate-100 pt-2 mt-1" style={{ paddingRight: "36px" }}>
            <span className="text-muted-foreground font-medium flex items-center gap-1"><Calculator className="w-3 h-3" />Total {title}</span>
            <span className="font-bold" style={{ color }}>{formatFCFA(Math.round(total))}</span>
          </div>
        </div>
      )}
      <Button size="sm" variant="outline" onClick={onAdd} className="w-full h-7 text-xs border-dashed mt-1">
        <Plus className="w-3.5 h-3.5 mr-1" />Ajouter un poste
      </Button>
    </div>
  );
}

// ─── UnifiedStructurePanel ────────────────────────────────────────────────────

function UnifiedStructurePanel({
  config, onUpdate, ytdCharges, ytdMonthsElapsed, realBurnRates, ytdRevenues, priceHT, directCostsAmount, periodBurnRate,
}: {
  config: StructureCostConfig;
  onUpdate: (patch: Partial<StructureCostConfig>) => void;
  ytdCharges: number;
  ytdMonthsElapsed: number;
  realBurnRates: RealBurnRates | null;
  ytdRevenues: number;
  priceHT: number;
  directCostsAmount: number;
  periodBurnRate: RealBurnRates | null;
}) {
  // Duration unit helpers
  const durationUnit: DealDurationUnit = config.dealDurationUnit ?? "mois";
  const durationUnitMeta = DEAL_DURATION_UNIT_META[durationUnit];
  const effectiveDurationMonths = toEffectiveMonths(config.dealDurationMonths, durationUnit);

  // Auto-allocation denominator: real burn rate (preferred) or manual monthlyCapacity fallback
  const autoDenominator = periodBurnRate?.total ?? (config.monthlyCapacity > 0 ? config.monthlyCapacity : 0);
  const hasBurnRateData = !!periodBurnRate?.total;

  const autoEffectivePct = autoDenominator > 0 && directCostsAmount > 0
    ? Math.min(100, (directCostsAmount / autoDenominator) * 100)
    : 0;

  // Build effective config (override dealConsumption/dealAllocationPct when auto is on)
  const effectiveCfg: StructureCostConfig = config.autoAllocation && directCostsAmount > 0
    ? config.allocationMode === "capacity"
      ? { ...config, dealConsumption: directCostsAmount }
      : { ...config, dealAllocationPct: autoEffectivePct }
    : config;

  const sc = computeStructureCosts(effectiveCfg);
  const totalMonthly = config.operational.monthlyBudget + config.admin.monthlyBudget +
    config.commercial.monthlyBudget + config.financial.monthlyBudget;

  // Auto deal-share: priceHT / monthly_revenue_rate * 100
  const monthlyRevenue = ytdRevenues > 0 && ytdMonthsElapsed > 0 ? ytdRevenues / ytdMonthsElapsed : 0;
  const autoSharePct = monthlyRevenue > 0 && priceHT > 0 && config.dealDurationMonths > 0
    ? Math.min(100, (priceHT / config.dealDurationMonths) / monthlyRevenue * 100)
    : 0;

  const autoFill = () => {
    if (realBurnRates?.hasData) {
      onUpdate({
        operational: { monthlyBudget: realBurnRates.operational },
        admin:        { monthlyBudget: realBurnRates.admin },
        commercial:   { monthlyBudget: realBurnRates.commercial },
        financial:    { monthlyBudget: realBurnRates.financial },
      });
      toast.success("Burn rates réels importés depuis la comptabilité !", {
        description: `Total : ${formatFCFA(realBurnRates.total)}/mois · Source : Classe 6 SYSCOHADA`,
      });
    } else if (ytdCharges > 0) {
      const monthly = Math.round(ytdCharges / Math.max(1, ytdMonthsElapsed));
      onUpdate({
        operational: { monthlyBudget: Math.round(monthly * 0.40) },
        admin:        { monthlyBudget: Math.round(monthly * 0.35) },
        commercial:   { monthlyBudget: Math.round(monthly * 0.15) },
        financial:    { monthlyBudget: Math.round(monthly * 0.10) },
      });
      toast.success("Budgets estimés depuis le compte de résultat", {
        description: "Aucune donnée détaillée disponible — répartition proportionnelle appliquée",
      });
    }
  };

  const syncSection = (sec: "operational" | "admin" | "commercial" | "financial") => {
    if (!realBurnRates) return;
    onUpdate({ [sec]: { monthlyBudget: realBurnRates[sec] } });
  };

  const updateSection = (sec: "operational" | "admin" | "commercial" | "financial", val: number) => {
    onUpdate({ [sec]: { monthlyBudget: val } });
  };

  const sections: Array<{
    key: "operational" | "admin" | "commercial" | "financial";
    label: string; icon: React.FC<{ className?: string; style?: React.CSSProperties }>;
    color: string; syscohadaHint: string;
  }> = [
    { key: "operational", label: "Charges opérationnelles", icon: Wrench,    color: "#0EA5E9", syscohadaHint: "60x · 61x · 624 — Achats, transports, maintenance" },
    { key: "admin",       label: "Admin & structure",        icon: Building2, color: "#64748B", syscohadaHint: "622 · 625 · 628 · 64x · 66x — Loyer, salaires, télécom, impôts" },
    { key: "commercial",  label: "Commercial & marketing",   icon: Megaphone, color: "#A855F7", syscohadaHint: "627 — Publicité, marketing, relations publiques" },
    { key: "financial",   label: "Frais financiers",         icon: Banknote,  color: "#EF4444", syscohadaHint: "631 · 671 · 681 — Frais bancaires, intérêts, dotations" },
  ];

  const hasRealData = !!realBurnRates?.hasData;

  return (
    <div className="space-y-4">

      {/* Source banner */}
      {hasRealData ? (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                  Burn rates réels disponibles
                  <span className="bg-emerald-200 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full">SYSCOHADA Classe 6</span>
                </div>
                <div className="text-[10px] text-emerald-700 mt-0.5">
                  Total <strong>{formatFCFA(realBurnRates!.total)}/mois</strong> · calculé sur {ytdMonthsElapsed} mois de données réelles · {ytdCharges > 0 && `YTD : ${formatFCFA(ytdCharges)}`}
                </div>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={autoFill}
              className="shrink-0 text-xs h-8 border-emerald-300 text-emerald-700 hover:bg-emerald-100 gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />Sync comptabilité
            </Button>
          </div>
          <div className="mt-2 text-[10px] text-emerald-600 flex gap-3 flex-wrap">
            {sections.map(s => (
              <span key={s.key}>
                {s.label.split(" ")[0]} : <strong>{formatFCFA(realBurnRates![s.key])}/m</strong>
              </span>
            ))}
          </div>
        </div>
      ) : ytdCharges > 0 ? (
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4 text-amber-600" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-amber-800">Données globales disponibles (pas de détail par compte)</div>
                <div className="text-[10px] text-amber-700 mt-0.5">
                  {formatFCFA(ytdCharges)} de charges sur {ytdMonthsElapsed} mois → <strong>{formatFCFA(Math.round(ytdCharges / Math.max(1, ytdMonthsElapsed)))}/mois</strong> estimé
                </div>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={autoFill}
              className="shrink-0 text-xs h-8 border-amber-300 text-amber-700 hover:bg-amber-100 gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />Auto-remplir
            </Button>
          </div>
          <div className="mt-1.5 text-[10px] text-amber-600">
            Aucun mouvement comptable détaillé trouvé — répartition proportionnelle 40/35/15/10% appliquée. Saisissez des écritures comptables pour obtenir la répartition réelle.
          </div>
        </div>
      ) : null}

      {/* Shared allocation parameters */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">Paramètres d'allocation</span>
          <span className="text-[10px] text-muted-foreground">(communs à toutes les sections)</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Durée du deal</Label>
            <div className="flex gap-1">
              <Input type="number" min="0.1" step={durationUnit === "mois" ? "0.5" : "1"}
                value={config.dealDurationMonths || ""}
                placeholder={durationUnit === "heures" ? "ex. 40" : durationUnit === "jours" ? "ex. 5" : durationUnit === "semaines" ? "ex. 4" : "ex. 1"}
                onChange={e => onUpdate({ dealDurationMonths: parseFloat(e.target.value) || 1 })}
                className="h-9 text-sm flex-1 min-w-0" />
              <div className="flex rounded-lg overflow-hidden border border-slate-200 shrink-0">
                {(["heures","jours","semaines","mois"] as DealDurationUnit[]).map(u => (
                  <button key={u}
                    onClick={() => onUpdate({ dealDurationUnit: u })}
                    className={`h-9 px-1.5 text-[10px] font-medium border-l border-slate-200 first:border-l-0 transition-colors ${durationUnit === u ? "bg-slate-800 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
                    {DEAL_DURATION_UNIT_META[u].short}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {durationUnit !== "mois"
                ? `${config.dealDurationMonths} ${durationUnitMeta.long} ≈ ${effectiveDurationMonths.toFixed(2)} mois effectifs`
                : "Combien de mois ce deal mobilise-t-il votre structure ?"}
            </p>
          </div>
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Mode d'allocation</Label>
            <div className="flex gap-1.5">
              <button onClick={() => onUpdate({ allocationMode: "pct" })}
                className={`flex-1 h-9 rounded-lg text-xs font-medium border transition-all ${config.allocationMode === "pct" ? "bg-slate-800 text-white border-slate-800" : "border-slate-200 text-slate-600 hover:bg-slate-100"}`}>
                <Percent className="w-3 h-3 inline mr-0.5" />% direct
              </button>
              <button onClick={() => onUpdate({ allocationMode: "capacity" })}
                className={`flex-1 h-9 rounded-lg text-xs font-medium border transition-all ${config.allocationMode === "capacity" ? "bg-slate-800 text-white border-slate-800" : "border-slate-200 text-slate-600 hover:bg-slate-100"}`}>
                <Target className="w-3 h-3 inline mr-0.5" />Capacité
              </button>
            </div>
          </div>
        </div>

        {/* Auto-allocation toggle */}
        <div className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors ${config.autoAllocation ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`}>
          <div className="flex items-center gap-2">
            <Calculator className={`w-3.5 h-3.5 ${config.autoAllocation ? "text-emerald-600" : "text-slate-400"}`} />
            <div>
              <div className={`text-xs font-semibold ${config.autoAllocation ? "text-emerald-800" : "text-slate-600"}`}>
                Allocation automatique depuis les coûts directs
              </div>
              <div className="text-[10px] text-muted-foreground">
                {directCostsAmount > 0
                  ? `${formatFCFA(Math.round(directCostsAmount))} (MO + opérations + matières)`
                  : "Saisissez des coûts directs (MO, opérations…) pour activer"}
              </div>
            </div>
          </div>
          <Switch
            checked={config.autoAllocation}
            disabled={directCostsAmount === 0}
            onCheckedChange={v => onUpdate({ autoAllocation: v })}
          />
        </div>

        {config.allocationMode === "pct" ? (
          <div className="space-y-2">
            <Label className="text-xs font-medium block">Part de votre activité représentée par ce deal (%)</Label>
            {config.autoAllocation && directCostsAmount > 0 ? (
              <div className="space-y-3">
                {/* Sélecteur de période burn rate */}
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] text-slate-500 shrink-0 whitespace-nowrap">Période burn rate :</Label>
                  <Select
                    value={config.burnRatePeriod ?? "ytd"}
                    onValueChange={v => onUpdate({ burnRatePeriod: v as BurnRatePeriod })}
                  >
                    <SelectTrigger className="h-7 text-xs w-52">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(BURN_RATE_PERIOD_LABELS) as [BurnRatePeriod, string][]).map(([k, label]) => (
                        <SelectItem key={k} value={k}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {hasBurnRateData ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="h-9 px-3 flex items-center bg-emerald-50 border border-emerald-300 rounded-md text-sm font-bold text-emerald-800 w-32">
                        {autoEffectivePct.toFixed(1)}%
                      </div>
                      <span className="text-xs text-emerald-700 bg-emerald-100 px-2 py-1 rounded-lg font-semibold">
                        {formatFCFA(Math.round(directCostsAmount))} ÷ {formatFCFA(Math.round(autoDenominator))} = {autoEffectivePct.toFixed(1)}% × {config.dealDurationMonths} {durationUnitMeta.short}{durationUnit !== "mois" ? ` (≈ ${effectiveDurationMonths.toFixed(2)} mois)` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-700">
                      <BarChart2 className="w-3 h-3 shrink-0" />
                      <span>Burn rate moyen comptabilité : <strong>{formatFCFA(Math.round(autoDenominator))}/mois</strong> · {BURN_RATE_PERIOD_LABELS[config.burnRatePeriod ?? "ytd"]}</span>
                    </div>
                    {autoEffectivePct >= 99 && (
                      <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        Quote-part ≥ 99% — vérifiez le burn rate comptable de la période.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      Aucune écriture comptable sur cette période. Saisissez le burn rate manuellement :
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-[10px] text-slate-500 shrink-0 whitespace-nowrap">Burn rate mensuel (FCFA) :</Label>
                      <Input type="number" min="1"
                        value={config.monthlyCapacity || ""}
                        placeholder="ex. 50000000"
                        onChange={e => onUpdate({ monthlyCapacity: parseFloat(e.target.value) || 1 })}
                        className="h-7 text-xs w-44" />
                    </div>
                    {config.monthlyCapacity > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="h-9 px-3 flex items-center bg-slate-50 border border-slate-300 rounded-md text-sm font-bold text-slate-800 w-32">
                          {autoEffectivePct.toFixed(1)}%
                        </div>
                        <span className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-lg font-semibold">
                          {formatFCFA(Math.round(directCostsAmount))} ÷ {formatFCFA(Math.round(config.monthlyCapacity))} = {autoEffectivePct.toFixed(1)}% × {config.dealDurationMonths} {durationUnitMeta.short}{durationUnit !== "mois" ? ` (≈ ${effectiveDurationMonths.toFixed(2)} mois)` : ""}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input type="number" min="0" max="100" step="0.5"
                  value={config.dealAllocationPct || ""}
                  placeholder="ex. 20"
                  onChange={e => onUpdate({ dealAllocationPct: parseFloat(e.target.value) || 0 })}
                  className="h-9 text-sm w-32" />
                {config.dealAllocationPct > 0 && (
                  <span className="text-xs font-bold text-slate-700 bg-slate-200 px-2 py-1 rounded-lg">
                    {config.dealAllocationPct.toFixed(1)}% × {config.dealDurationMonths} {durationUnitMeta.short}{durationUnit !== "mois" ? ` (≈ ${effectiveDurationMonths.toFixed(2)} mois)` : ""}
                  </span>
                )}
                {autoSharePct > 0 && Math.abs(autoSharePct - config.dealAllocationPct) > 0.5 && (
                  <button
                    onClick={() => {
                      onUpdate({ dealAllocationPct: Math.round(autoSharePct * 10) / 10 });
                      toast.success("Part du deal calculée automatiquement", {
                        description: `${(Math.round(autoSharePct * 10) / 10).toFixed(1)}% = Prix HT (${formatFCFA(Math.round(priceHT))}) ÷ CA mensuel moyen (${formatFCFA(Math.round(monthlyRevenue))})`,
                      });
                    }}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors shrink-0">
                    <Calculator className="w-3 h-3" />
                    Auto : {(Math.round(autoSharePct * 10) / 10).toFixed(1)}%
                  </button>
                )}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">
              {config.autoAllocation && directCostsAmount > 0
                ? hasBurnRateData
                  ? `Calculé automatiquement : coûts directs du deal ÷ burn rate moyen comptable (${BURN_RATE_PERIOD_LABELS[config.burnRatePeriod ?? "ytd"]}).`
                  : "Calculé automatiquement : coûts directs du deal ÷ burn rate mensuel (saisie manuelle — aucune donnée comptable)."
                : autoSharePct > 0
                  ? `Suggestion calculée : prix HT du deal ÷ CA mensuel moyen (${formatFCFA(Math.round(monthlyRevenue))}/mois) = ${(Math.round(autoSharePct * 10) / 10).toFixed(1)}%`
                  : "Ex. ce deal représente 20% de votre activité ce mois. Activez le mode Auto pour calculer depuis les coûts directs saisis."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Sélecteur période burn rate — mode capacity + auto ON */}
            {config.autoAllocation && (
              <div className="flex items-center gap-2">
                <Label className="text-[10px] text-slate-500 shrink-0 whitespace-nowrap">Période burn rate :</Label>
                <Select
                  value={config.burnRatePeriod ?? "ytd"}
                  onValueChange={v => onUpdate({ burnRatePeriod: v as BurnRatePeriod })}
                >
                  <SelectTrigger className="h-7 text-xs w-52">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(BURN_RATE_PERIOD_LABELS) as [BurnRatePeriod, string][]).map(([k, label]) => (
                      <SelectItem key={k} value={k}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 items-end">
              <div className="col-span-2">
                <Label className="text-xs font-medium mb-1.5 block">
                  Capacité mensuelle totale
                </Label>
                <div className="flex gap-1.5">
                  <Input type="number" min="1"
                    value={config.monthlyCapacity || ""}
                    placeholder="ex. 160"
                    onChange={e => onUpdate({ monthlyCapacity: parseFloat(e.target.value) || 1 })}
                    className="h-9 text-sm flex-1" />
                  <Input value={config.capacityUnit} placeholder="h"
                    onChange={e => onUpdate({ capacityUnit: e.target.value })}
                    className="h-9 text-sm w-20" />
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Capacité totale de votre structure par mois (ex. 160h, 10 projets…)
                </p>
              </div>
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Part de ce deal</Label>
                {config.autoAllocation && directCostsAmount > 0 ? (
                  <div className="h-9 px-3 flex items-center bg-emerald-50 border border-emerald-300 rounded-md text-xs font-bold text-emerald-800 truncate">
                    {formatFCFA(Math.round(directCostsAmount))}
                  </div>
                ) : (
                  <Input type="number" min="0"
                    value={config.dealConsumption || ""}
                    placeholder="ex. 32"
                    onChange={e => onUpdate({ dealConsumption: parseFloat(e.target.value) || 0 })}
                    className="h-9 text-sm" />
                )}
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {config.autoAllocation && directCostsAmount > 0 ? "Coûts directs du deal" : `${config.capacityUnit || "h"} consommés`}
                </p>
              </div>
            </div>
            {config.monthlyCapacity > 0 && (config.autoAllocation ? directCostsAmount : config.dealConsumption) > 0 && (
              <div className={`border rounded-lg px-3 py-2 text-xs flex items-center gap-2 ${config.autoAllocation ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200"}`}>
                <ArrowRight className={`w-3 h-3 shrink-0 ${config.autoAllocation ? "text-emerald-500" : "text-muted-foreground"}`} />
                <span className={config.autoAllocation ? "text-emerald-700" : "text-muted-foreground"}>
                  {config.autoAllocation ? formatFCFA(Math.round(directCostsAmount)) : formatFCFA(config.dealConsumption)} / {config.monthlyCapacity} {config.capacityUnit || "h"} = <strong className={config.autoAllocation ? "text-emerald-900" : "text-slate-800"}>
                    {Math.min(100, ((config.autoAllocation ? directCostsAmount : config.dealConsumption) / config.monthlyCapacity) * 100).toFixed(1)}%
                  </strong> de la capacité mensuelle
                  {config.autoAllocation && <span className="ml-1 text-[10px] font-semibold bg-emerald-200 text-emerald-700 px-1.5 py-0.5 rounded-full">AUTO</span>}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Per-section budget rows */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-100 px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-600">
          <span>Burn rates mensuels par section</span>
          <div className="flex items-center gap-3">
            {hasRealData && (
              <span className="text-emerald-700 text-[10px] font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />Comptabilité disponible
              </span>
            )}
            {totalMonthly > 0 && (
              <span className="text-slate-700 font-bold">Total : {formatFCFA(totalMonthly)}/mois</span>
            )}
          </div>
        </div>

        {sections.map((sec, i) => {
          const monthly = config[sec.key].monthlyBudget;
          const allocated = monthly * effectiveDurationMonths * (sc.effectivePct / 100);
          const realMonthly = realBurnRates?.[sec.key] ?? 0;
          const diff = monthly > 0 && realMonthly > 0 ? monthly - realMonthly : 0;
          const diffPct = realMonthly > 0 && diff !== 0 ? (diff / realMonthly) * 100 : 0;
          return (
            <div key={sec.key} className={`px-4 py-3.5 bg-white ${i > 0 ? "border-t border-slate-100" : ""}`}>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: sec.color + "18" }}>
                  <sec.icon className="w-3.5 h-3.5" style={{ color: sec.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-slate-700">{sec.label}</span>
                    {realMonthly > 0 && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        Réel : {formatFCFA(realMonthly)}/m
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{sec.syscohadaHint}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Sync button */}
                  {hasRealData && realMonthly > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button onClick={() => syncSection(sec.key)}
                          className={`h-8 w-8 rounded-lg flex items-center justify-center border transition-colors ${monthly === realMonthly ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-slate-600"}`}>
                          <RefreshCw className="w-3 h-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs">
                        {monthly === realMonthly ? "Synchronisé avec la comptabilité" : `Synchroniser avec la valeur réelle (${formatFCFA(realMonthly)}/mois)`}
                      </TooltipContent>
                    </Tooltip>
                  )}
                  {/* Manual input */}
                  <div className="text-right">
                    <Input type="number" min="0" step="10000"
                      value={monthly || ""}
                      placeholder={realMonthly > 0 ? String(realMonthly) : "0"}
                      onChange={e => updateSection(sec.key, parseFloat(e.target.value) || 0)}
                      className={`h-8 text-sm w-36 text-right ${monthly > 0 && realMonthly > 0 && monthly !== realMonthly ? "border-amber-300 bg-primary/5" : ""}`} />
                    <div className="text-[10px] mt-0.5 text-right">
                      {diff !== 0 && realMonthly > 0 && monthly > 0 ? (
                        <span className={diff > 0 ? "text-amber-600" : "text-emerald-600"}>
                          {diff > 0 ? "+" : ""}{formatFCFA(Math.round(diff))} vs réel ({diffPct > 0 ? "+" : ""}{diffPct.toFixed(0)}%)
                        </span>
                      ) : (
                        <span className="text-muted-foreground">FCFA/mois</span>
                      )}
                    </div>
                  </div>
                  {/* Allocated */}
                  <div className="w-24 text-right">
                    {allocated > 0 ? (
                      <>
                        <div className="text-xs font-bold" style={{ color: sec.color }}>{formatFCFA(Math.round(allocated))}</div>
                        <div className="text-[10px] text-muted-foreground">alloué</div>
                      </>
                    ) : (
                      <div className="text-[10px] text-muted-foreground italic">—</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {sc.total > 0 && (
          <div className="bg-slate-800 px-4 py-3 flex items-center justify-between">
            <div className="text-xs text-slate-300">
              Quote-part totale ({sc.effectivePct.toFixed(1)}% × {config.dealDurationMonths} {durationUnitMeta.short}{durationUnit !== "mois" ? `, ≈ ${effectiveDurationMonths.toFixed(2)} mois` : ""})
            </div>
            <div className="text-sm font-black text-white">{formatFCFA(Math.round(sc.total))}</div>
          </div>
        )}

        {sc.total === 0 && (
          <div className="px-4 py-3 bg-amber-50 border-t border-amber-100 text-xs text-amber-700 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {totalMonthly === 0
              ? `Cliquez sur « ${hasRealData ? "Sync comptabilité" : "Auto-remplir"} » pour importer les burn rates ${hasRealData ? "réels" : "estimés"}, ou saisissez-les manuellement.`
              : "Renseignez le taux d'allocation (ou la part du deal) pour calculer la quote-part."}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function loadSavedScenarios(): Scenario[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Scenario[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [];
  } catch { return []; }
}

export default function PricingCalculator() {
  const [scenarios, setScenarios] = useState<Scenario[]>(() => {
    const saved = loadSavedScenarios();
    return saved.length > 0 ? saved : [{ ...DEFAULT_SCENARIO, id: uid() }];
  });
  const [activeScenarioId, setActiveScenarioId] = useState<string>(scenarios[0].id);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showHRDialog, setShowHRDialog] = useState(false);
  const [showEquipDialog, setShowEquipDialog] = useState(false);
  const [showInventoryDialog, setShowInventoryDialog] = useState(false);
  const [sendDocType, setSendDocType] = useState<DocTarget | null>(null);
  const [activeTab, setActiveTab] = useState("directs");

  // ─── Save / Share / PDF state ─────────────────────────────────────────────
  const [savedId, setSavedId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareEnabled, setShareEnabled] = useState(false);
  const [showScenarioList, setShowScenarioList] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showCompareDialog, setShowCompareDialog] = useState(false);
  const [savedScenariosMeta, setSavedScenariosMeta] = useState<SavedScenarioMeta[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());
  const toggleComponent = (id: string) => setExpandedComponents(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const scenario = scenarios.find(s => s.id === activeScenarioId) ?? scenarios[0];

  // ─── Fiscal config ────────────────────────────────────────────────────────
  const { data: ytdData, isLoading: loadingYtd } = useQuery<{
    ytdRevenues: number; ytdCharges: number; ytdProfitBeforeTax: number;
    ytdEstimatedTax: number; ytdNetProfit: number; isEnabled: boolean;
    period: { from: string; to?: string };
  }>({ queryKey: ["ytd-profit"], queryFn: () => apiFetch("/api/accounting/ytd-profit") });

  const { data: fiscalSettings } = useQuery<{
    corporateTaxEnabled: boolean; corporateTaxBrackets: TaxBracket[];
  }>({ queryKey: ["fiscal-settings"], queryFn: () => apiFetch("/api/accounting/fiscal-settings") });

  const fiscalConfig: CorporateTaxConfig = useMemo(() => ({
    enabled: fiscalSettings?.corporateTaxEnabled ?? false,
    ytdProfitBeforeTax: ytdData?.ytdProfitBeforeTax ?? 0,
    ytdEstimatedTax:    ytdData?.ytdEstimatedTax ?? 0,
    ytdNetProfit:       ytdData?.ytdNetProfit ?? 0,
    brackets: fiscalSettings?.corporateTaxBrackets?.length
      ? fiscalSettings.corporateTaxBrackets
      : DEFAULT_TAX_BRACKETS,
  }), [ytdData, fiscalSettings]);

  // ─── Clients + Prospects ──────────────────────────────────────────────────
  const { data: clientsRes } = useQuery<{ data: { id: string; name: string }[] }>({
    queryKey: ["clients-list-pricing"], queryFn: () => apiFetch("/api/clients?limit=100"),
  });
  const clients = clientsRes?.data ?? [];
  const { data: prospectsRes } = useQuery<{ data: { id: string; title: string; clientId?: string | null }[] }>({
    queryKey: ["prospects-list-pricing"], queryFn: () => apiFetch("/api/crm/opportunities?limit=100"),
  });
  const prospects = prospectsRes?.data ?? [];

  // ─── Mutation helpers ─────────────────────────────────────────────────────
  const updateScenario = useCallback((patch: Partial<Scenario>) => {
    setScenarios(prev => prev.map(s => s.id === activeScenarioId ? { ...s, ...patch } : s));
    setIsDirty(true);
  }, [activeScenarioId]);

  const addItem = (field: keyof Scenario, cat: CostCategory, alloc: AllocMethod = "fixed", qtyUnit?: string) => {
    const newItem: CostItem = { id: uid(), label: "", category: cat, alloc, amount: 0, qty: alloc === "per_unit" ? 1 : undefined, qtyUnit };
    updateScenario({ [field]: [...((scenario[field] as CostItem[]) ?? []), newItem] });
  };

  const updateItem = (field: keyof Scenario, id: string, patch: Partial<CostItem>) => {
    updateScenario({ [field]: (scenario[field] as CostItem[]).map(i => i.id === id ? { ...i, ...patch } : i) });
  };

  const removeItem = (field: keyof Scenario, id: string) => {
    updateScenario({ [field]: (scenario[field] as CostItem[]).filter(i => i.id !== id) });
  };

  const addLaborLine = () => {
    const line: LaborLineItem = {
      id: uid(), name: "Collaborateur", contractType: "CDI",
      monthlySalaryBrut: 0, employerChargeRate: scenario.laborSettings.employerChargeRate,
      benefitsMonthly: 0, weeklyHours: scenario.laborSettings.weeklyHours, allocatedHours: 8,
    };
    updateScenario({ laborLines: [...(scenario.laborLines ?? []), line] });
  };

  const updateLaborLine = (id: string, patch: Partial<LaborLineItem>) => {
    updateScenario({ laborLines: (scenario.laborLines ?? []).map(l => l.id === id ? { ...l, ...patch } : l) });
  };

  const removeLaborLine = (id: string) => {
    updateScenario({ laborLines: (scenario.laborLines ?? []).filter(l => l.id !== id) });
  };

  const updateStructureCosts = (patch: Partial<StructureCostConfig>) => {
    updateScenario({ structureCosts: { ...(scenario.structureCosts ?? DEFAULT_STRUCTURE_COSTS), ...patch } });
  };

  const addDealComponent = () => {
    const comp: DealComponent = { id: uid(), label: "Nouvelle composante", dealType: "service", durationValue: 5, durationUnit: "jours", costItems: [] };
    updateScenario({ dealComponents: [...(scenario.dealComponents ?? []), comp] });
    setExpandedComponents(prev => new Set([...prev, comp.id]));
  };
  const updateDealComponent = (id: string, patch: Partial<DealComponent>) =>
    updateScenario({ dealComponents: (scenario.dealComponents ?? []).map(c => c.id === id ? { ...c, ...patch } : c) });
  const removeDealComponent = (id: string) =>
    updateScenario({ dealComponents: (scenario.dealComponents ?? []).filter(c => c.id !== id) });
  const addComponentCostItem = (compId: string) => {
    const item: CostItem = { id: uid(), label: "", category: "direct", alloc: "fixed", amount: 0 };
    updateScenario({ dealComponents: (scenario.dealComponents ?? []).map(c => c.id === compId ? { ...c, costItems: [...(c.costItems ?? []), item] } : c) });
  };
  const updateComponentItem = (compId: string, itemId: string, patch: Partial<CostItem>) =>
    updateScenario({ dealComponents: (scenario.dealComponents ?? []).map(c => c.id === compId ? { ...c, costItems: (c.costItems ?? []).map(i => i.id === itemId ? { ...i, ...patch } : i) } : c) });
  const removeComponentItem = (compId: string, itemId: string) =>
    updateScenario({ dealComponents: (scenario.dealComponents ?? []).map(c => c.id === compId ? { ...c, costItems: (c.costItems ?? []).filter(i => i.id !== itemId) } : c) });

  // How many months elapsed since fiscal year start (for auto-fill from P&L)
  const ytdMonthsElapsed = useMemo(() => {
    const from = ytdData?.period?.from;
    if (!from) return 12;
    const ms = Date.now() - new Date(from).getTime();
    return Math.max(1, Math.round(ms / (30.44 * 24 * 60 * 60 * 1000)));
  }, [ytdData?.period?.from]);

  // Real burn rates — YTD (used for autoFill of per-section budgets)
  const { data: class6Balance } = useQuery<{ data: BalanceRow[] }>({
    queryKey: ["class6-balance-ytd", ytdData?.period?.from, ytdData?.period?.to],
    queryFn: () => {
      const qs = new URLSearchParams({ classNum: "6" });
      if (ytdData?.period?.from) qs.set("from", ytdData.period.from);
      if (ytdData?.period?.to)   qs.set("to",   ytdData.period.to);
      return apiFetch(`/api/accounting/balance?${qs}`);
    },
    enabled: !!ytdData?.period?.from,
    staleTime: 5 * 60 * 1000,
  });

  const realBurnRates = useMemo<RealBurnRates | null>(() => {
    if (!class6Balance?.data?.length) return null;
    const rates = mapClass6ToSections(class6Balance.data, ytdMonthsElapsed);
    return rates.hasData ? rates : null;
  }, [class6Balance, ytdMonthsElapsed]);

  // Period-specific burn rate for auto-allocation denominator
  const burnRatePeriod: BurnRatePeriod = (scenario.structureCosts ?? DEFAULT_STRUCTURE_COSTS).burnRatePeriod ?? "ytd";
  const burnRateDateRange = useMemo(
    () => getBurnRateDateRange(burnRatePeriod, ytdData?.period),
    [burnRatePeriod, ytdData?.period?.from, ytdData?.period?.to],
  );
  const { data: periodClass6Data } = useQuery<{ data: BalanceRow[] }>({
    queryKey: ["class6-burnrate", burnRateDateRange.from, burnRateDateRange.to],
    queryFn: () => {
      const qs = new URLSearchParams({ classNum: "6" });
      qs.set("from", burnRateDateRange.from);
      qs.set("to",   burnRateDateRange.to);
      return apiFetch(`/api/accounting/balance?${qs}`);
    },
    enabled: !!burnRateDateRange.from,
    staleTime: 5 * 60 * 1000,
  });
  const periodBurnRate = useMemo<RealBurnRates | null>(() => {
    if (!periodClass6Data?.data?.length) return null;
    const rates = mapClass6ToSections(periodClass6Data.data, burnRateDateRange.months);
    return rates.hasData ? rates : null;
  }, [periodClass6Data, burnRateDateRange.months]);

  const addScenario = () => {
    const ns: Scenario = { ...scenario, id: uid(), name: `Scénario ${scenarios.length + 1}` };
    setScenarios(prev => [...prev, ns]);
    setActiveScenarioId(ns.id);
    setSavedId(null);
    setShareToken(null);
    setShareEnabled(false);
    setIsDirty(false);
  };

  // ─── API: Enregistrer ─────────────────────────────────────────────────────
  const saveScenario = async () => {
    setIsSaving(true);
    try {
      const payload = {
        name: scenario.name || "Scénario sans titre",
        description: scenario.description ?? null,
        productName: scenario.productName ?? null,
        clientId: scenario.clientId && !scenario.clientId.startsWith("prospect:") ? scenario.clientId : null,
        scenarioData: scenario as unknown as Record<string, unknown>,
        resultData: result as unknown as Record<string, unknown>,
        notes: null,
      };
      let saved: SavedScenarioMeta & { shareToken: string; shareEnabled: boolean };
      if (savedId) {
        saved = await apiFetch(`/api/pricing/scenarios/${savedId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        saved = await apiFetch("/api/pricing/scenarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setSavedId(saved.id);
      setShareToken(saved.shareToken);
      setShareEnabled(saved.shareEnabled);
      setIsDirty(false);
      toast.success("Scénario enregistré");
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setIsSaving(false);
    }
  };

  // ─── API: Liste des scénarios sauvegardés ─────────────────────────────────
  const loadScenariosList = async () => {
    try {
      const res = await apiFetch("/api/pricing/scenarios?limit=50") as { data: SavedScenarioMeta[] };
      setSavedScenariosMeta(res.data ?? []);
    } catch { /* ignore */ }
  };

  // ─── API: Charger un scénario sauvegardé ─────────────────────────────────
  const loadSavedScenario = async (id: string) => {
    try {
      const res = await apiFetch(`/api/pricing/scenarios/${id}`) as {
        id: string; name: string; scenarioData: Scenario;
        shareToken: string; shareEnabled: boolean;
      };
      if (!res.scenarioData) { toast.error("Données du scénario introuvables"); return; }
      const loaded = { ...res.scenarioData, id: uid() };
      setScenarios(prev => [...prev, loaded]);
      setActiveScenarioId(loaded.id);
      setSavedId(res.id);
      setShareToken(res.shareToken);
      setShareEnabled(res.shareEnabled);
      setIsDirty(false);
      setShowScenarioList(false);
      toast.success(`Scénario "${res.name}" chargé`);
    } catch {
      toast.error("Erreur lors du chargement");
    }
  };

  // ─── API: Dupliquer ───────────────────────────────────────────────────────
  const duplicateScenarioAPI = async () => {
    if (!savedId) {
      const ns: Scenario = { ...scenario, id: uid(), name: `${scenario.name} (copie)` };
      setScenarios(prev => [...prev, ns]);
      setActiveScenarioId(ns.id);
      setSavedId(null);
      setShareToken(null);
      setShareEnabled(false);
      setIsDirty(true);
      toast.success("Scénario dupliqué (non sauvegardé)");
      return;
    }
    try {
      const dup = await apiFetch(
        `/api/pricing/scenarios/${savedId}/duplicate`,
        { method: "POST" },
      ) as SavedScenarioMeta & { shareToken: string; shareEnabled: boolean };
      const loaded = await apiFetch(`/api/pricing/scenarios/${dup.id}`) as {
        id: string; name: string; scenarioData: Scenario;
        shareToken: string; shareEnabled: boolean;
      };
      if (loaded.scenarioData) {
        const ns = { ...loaded.scenarioData, id: uid(), name: dup.name };
        setScenarios(prev => [...prev, ns]);
        setActiveScenarioId(ns.id);
      }
      setSavedId(dup.id);
      setShareToken(dup.shareToken);
      setShareEnabled(dup.shareEnabled);
      setIsDirty(false);
      toast.success(`Scénario dupliqué : "${dup.name}"`);
    } catch {
      toast.error("Erreur lors de la duplication");
    }
  };

  // ─── API: Partage ─────────────────────────────────────────────────────────
  const toggleShare = async () => {
    if (!savedId) { toast("Enregistrez d'abord le scénario"); return; }
    try {
      const res = await apiFetch(`/api/pricing/scenarios/${savedId}/share`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !shareEnabled }),
      }) as { shareEnabled: boolean };
      setShareEnabled(res.shareEnabled);
      toast.success(res.shareEnabled ? "Lien de partage activé" : "Partage désactivé");
    } catch {
      toast.error("Erreur lors du changement de partage");
    }
  };

  // ─── Export PDF ───────────────────────────────────────────────────────────
  const exportPDF = async () => {
    if (!savedId) {
      // Auto-save then export
      await saveScenario();
    }
    if (savedId || true) {
      // Re-read savedId after potential save
      setTimeout(() => {
        setSavedId(prev => {
          if (prev) window.open(`/api/pricing/scenarios/${prev}/export.pdf`, "_blank");
          else toast("Enregistrement nécessaire avant l'export PDF");
          return prev;
        });
      }, 100);
    }
  };

  const shareUrl = shareToken
    ? `${window.location.origin}/pricing/share/${shareToken}`
    : null;

  const copyShareLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const resetScenario = useCallback(() => {
    setScenarios(prev => prev.map(s =>
      s.id === activeScenarioId
        ? { ...DEFAULT_SCENARIO, id: s.id, name: s.name }
        : s
    ));
    setShowResetConfirm(false);
    toast.success("Scénario réinitialisé");
  }, [activeScenarioId]);

  // ─── Auto-save to localStorage ────────────────────────────────────────────
  React.useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios)); } catch { /* ignore quota errors */ }
  }, [scenarios]);

  // ─── Compute ──────────────────────────────────────────────────────────────
  const result = useMemo(() => calculate(scenario, fiscalConfig, periodBurnRate?.total), [scenario, fiscalConfig, periodBurnRate]);
  const recommendations = useMemo(() => generateRecommendations(result, scenario, fiscalConfig), [result, scenario, fiscalConfig]);

  // ─── Cost totals per section ──────────────────────────────────────────────
  const totalLaborCost = useMemo(() => (scenario.laborLines ?? []).reduce((sum, l) => sum + computeLaborLineCost(l).totalCost, 0), [scenario.laborLines]);
  const totalDirectCost = useMemo(() => (scenario.costItems ?? []).reduce((s, i) => s + computeItemCost(i, result.totalCost, result.priceHT), 0), [scenario.costItems, result]);
  const totalPurchaseCost = useMemo(() => (scenario.costItems ?? []).filter(i => i.category === "purchase").reduce((s, i) => s + computeItemCost(i, result.totalCost, result.priceHT), 0), [scenario.costItems, result]);
  const totalOperational = useMemo(() => (scenario.operationalItems ?? []).reduce((s, i) => s + computeItemCost(i, result.totalCost, result.priceHT), 0), [scenario.operationalItems, result]);
  const totalAdmin = useMemo(() => (scenario.adminItems ?? []).reduce((s, i) => s + computeItemCost(i, result.totalCost, result.priceHT), 0), [scenario.adminItems, result]);
  const totalCommercial = useMemo(() => (scenario.commercialItems ?? []).reduce((s, i) => s + computeItemCost(i, result.totalCost, result.priceHT), 0), [scenario.commercialItems, result]);
  const totalFinancial = useMemo(() => (scenario.financialItems ?? []).reduce((s, i) => s + computeItemCost(i, result.totalCost, result.priceHT), 0), [scenario.financialItems, result]);
  const totalRisk = useMemo(() => (scenario.riskItems ?? []).reduce((s, i) => s + computeItemCost(i, result.totalCost, result.priceHT), 0), [scenario.riskItems, result]);
  const totalDepr = useMemo(() => (scenario.depreciationItems ?? []).reduce((s, i) => s + computeItemCost(i, result.totalCost, result.priceHT), 0), [scenario.depreciationItems, result]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <TooltipProvider>
      <div className="p-4 space-y-4 max-w-[1600px] mx-auto">

        {/* Header — ligne 1 : titre + actions */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2563EB]/15 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-[#2563EB]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Calculateur tarifaire</h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                Pricing stratégique · coût complet · impact IS
                {savedId && !isDirty && (
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                    <Check className="w-3 h-3" />Enregistré
                  </span>
                )}
                {savedId && isDirty && (
                  <span className="inline-flex items-center gap-1 text-amber-500 font-medium">
                    <CloudUpload className="w-3 h-3" />Modifications non sauvegardées
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Mes scénarios sauvegardés */}
            <Button size="sm" variant="outline"
              onClick={() => { loadScenariosList(); setShowScenarioList(true); }}
              className="gap-1.5 text-xs">
              <FolderOpen className="w-3.5 h-3.5" />Mes scénarios
            </Button>

            {/* Enregistrer */}
            <Button size="sm"
              onClick={saveScenario}
              disabled={isSaving}
              className={`gap-1.5 text-xs ${savedId && !isDirty ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-[#2563EB] hover:bg-[#1d4ed8] text-white"}`}>
              {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {isSaving ? "Enregistrement…" : savedId && !isDirty ? "Enregistré" : "Enregistrer"}
            </Button>

            {/* Dupliquer */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" onClick={duplicateScenarioAPI} className="gap-1.5 text-xs">
                  <Copy className="w-3.5 h-3.5" />Dupliquer
                </Button>
              </TooltipTrigger>
              <TooltipContent>Créer une copie du scénario actuel</TooltipContent>
            </Tooltip>

            {/* Exporter PDF */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" onClick={exportPDF} className="gap-1.5 text-xs">
                  <Upload className="w-3.5 h-3.5" />PDF
                </Button>
              </TooltipTrigger>
              <TooltipContent>Exporter en PDF professionnel</TooltipContent>
            </Tooltip>

            {/* Partager */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline"
                  onClick={() => { if (!savedId) { saveScenario().then(() => setShowShareDialog(true)); } else setShowShareDialog(true); }}
                  className={`gap-1.5 text-xs ${shareEnabled ? "border-emerald-300 text-emerald-700 bg-emerald-50" : ""}`}>
                  <Share2 className="w-3.5 h-3.5" />Partager
                </Button>
              </TooltipTrigger>
              <TooltipContent>Générer un lien de partage</TooltipContent>
            </Tooltip>

            {/* Comparer */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline"
                  onClick={() => { loadScenariosList(); setShowCompareDialog(true); }}
                  className="gap-1.5 text-xs">
                  <GitCompare className="w-3.5 h-3.5" />Comparer
                </Button>
              </TooltipTrigger>
              <TooltipContent>Comparer plusieurs scénarios côte à côte</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Header — ligne 2 : onglets scénarios */}
        <div className="flex items-center gap-2 flex-wrap">
          {scenarios.map(s => (
            <Button key={s.id} size="sm" variant={s.id === activeScenarioId ? "default" : "outline"}
              className={s.id === activeScenarioId ? "bg-[#2563EB] text-white border-[#2563EB]" : ""}
              onClick={() => setActiveScenarioId(s.id)}>
              {s.name}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={addScenario} className="gap-1">
            <Plus className="w-3.5 h-3.5" />Nouveau scénario
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" onClick={() => setShowResetConfirm(true)} className="text-muted-foreground hover:text-destructive h-8 w-8 p-0">
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Réinitialiser le scénario</TooltipContent>
          </Tooltip>
        </div>

        <div className="grid grid-cols-12 gap-4">

          {/* ══ LEFT PANEL ══ */}
          <div className="col-span-12 lg:col-span-7 space-y-4">

            {/* General info */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm flex items-center gap-2"><Tag className="w-4 h-4 text-[#2563EB]" />Informations générales</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label className="text-xs">Produit / Prestation *</Label>
                    <Input value={scenario.productName} onChange={e => updateScenario({ productName: e.target.value })} placeholder="Nom du produit ou service…" className="h-8 mt-1 text-sm font-semibold" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Nature du deal</Label>
                    <Select
                      value={scenario.dealType ?? "__none__"}
                      onValueChange={v => {
                        if (v === "__none__") { updateScenario({ dealType: undefined }); return; }
                        const type = v as DealType;
                        const meta = DEAL_TYPE_META[type];
                        updateScenario({ dealType: type });
                        updateStructureCosts({ dealDurationUnit: meta.defaultUnit, dealDurationMonths: meta.defaultDuration });
                      }}
                    >
                      <SelectTrigger className="h-8 mt-1 text-xs">
                        <SelectValue placeholder="Choisir le type de deal…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sélectionner…</SelectItem>
                        {(Object.entries(DEAL_TYPE_META) as [DealType, typeof DEAL_TYPE_META[DealType]][]).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.icon} {v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {scenario.dealType && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{DEAL_TYPE_META[scenario.dealType].hint}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">Client / Prospect</Label>
                    <Select value={scenario.clientId || "__none__"} onValueChange={v => updateScenario({ clientId: v === "__none__" ? "" : v })}>
                      <SelectTrigger className="h-8 mt-1 text-xs"><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                      <SelectContent position="popper" className="max-h-64 overflow-y-auto">
                        <SelectItem value="__none__">Aucun</SelectItem>
                        {clients.length > 0 && (
                          <SelectGroup>
                            <SelectLabel className="text-[10px] text-muted-foreground px-2 py-1">Clients</SelectLabel>
                            {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectGroup>
                        )}
                        {prospects.length > 0 && (
                          <SelectGroup>
                            <SelectLabel className="text-[10px] text-muted-foreground px-2 py-1">Prospects</SelectLabel>
                            {prospects.map(p => <SelectItem key={`prospect:${p.id}`} value={`prospect:${p.id}`}>{p.title}</SelectItem>)}
                          </SelectGroup>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Catégorie</Label>
                    <Input value={scenario.category} onChange={e => updateScenario({ category: e.target.value })} placeholder="BTP, Génie civil, IT…" className="h-8 mt-1 text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Quantité</Label>
                    <Input type="number" min="1" value={scenario.quantity} onChange={e => updateScenario({ quantity: parseInt(e.target.value) || 1 })} className="h-8 mt-1 text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Unité</Label>
                    <Input value={scenario.unit} onChange={e => updateScenario({ unit: e.target.value })} placeholder="unité, m², h, j…" className="h-8 mt-1 text-xs" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Période / description</Label>
                    <Input value={scenario.period} onChange={e => updateScenario({ period: e.target.value })} placeholder="Ex : Janvier 2026 — Chantier Lomé Nord" className="h-8 mt-1 text-xs" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Composantes du deal (mixte mode) ── */}
            {scenario.dealType === "mixte" && (
              <Card className="shadow-sm border-slate-200">
                <CardHeader className="pb-3 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#2563EB]" />
                      <CardTitle className="text-sm">Composantes du deal</CardTitle>
                      {(scenario.dealComponents ?? []).length > 0 && (
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                          {(scenario.dealComponents ?? []).length} composante{(scenario.dealComponents ?? []).length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <Button size="sm" onClick={addDealComponent}
                      className="h-7 text-xs gap-1 bg-slate-800 hover:bg-slate-900 text-white">
                      <Plus className="w-3.5 h-3.5" />Ajouter
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Chaque composante a son propre type, durée et coûts directs. Les frais de structure sont alloués indépendamment par composante.
                  </p>
                </CardHeader>
                <CardContent className="pt-0 px-0 pb-0">
                  {(scenario.dealComponents ?? []).length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground text-xs px-4">
                      <Layers className="w-9 h-9 mx-auto mb-2 opacity-15" />
                      <p className="font-medium">Aucune composante — cliquez sur "Ajouter"</p>
                      <p className="mt-1 opacity-60 max-w-xs mx-auto">Ex. : "Phase déploiement 3 semaines" + "Maintenance mensuelle 12 mois" + "Location équipement 7 jours"</p>
                    </div>
                  ) : (
                    <div>
                      {(scenario.dealComponents ?? []).map((comp, idx) => {
                        const isExpanded = expandedComponents.has(comp.id);
                        const compResult = result.byComponentResult?.find(r => r.id === comp.id);
                        const compRawTotal = (comp.costItems ?? []).reduce((s, i) => s + computeItemCost(i, 0, 0), 0);
                        return (
                          <div key={comp.id} className={`border-b border-slate-100 last:border-b-0 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                            {/* Component header row */}
                            <div className="flex items-center gap-2 px-3 py-2.5">
                              <button onClick={() => toggleComponent(comp.id)} className="text-slate-400 hover:text-slate-600 shrink-0 w-5">
                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </button>
                              <span className="text-base shrink-0">{DEAL_TYPE_META[comp.dealType].icon}</span>
                              <Input
                                value={comp.label}
                                onChange={e => updateDealComponent(comp.id, { label: e.target.value })}
                                className="h-7 text-xs font-semibold flex-1 min-w-0 border-transparent bg-transparent hover:border-slate-200 focus:border-slate-300 px-1"
                                placeholder="Nom de la composante…"
                              />
                              <Select value={comp.dealType} onValueChange={v => {
                                const type = v as DealType;
                                updateDealComponent(comp.id, { dealType: type, durationValue: DEAL_TYPE_META[type].defaultDuration, durationUnit: DEAL_TYPE_META[type].defaultUnit });
                              }}>
                                <SelectTrigger className="h-7 w-36 text-[10px] shrink-0"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {(Object.entries(DEAL_TYPE_META) as [DealType, typeof DEAL_TYPE_META[DealType]][]).map(([k, v]) => (
                                    <SelectItem key={k} value={k} className="text-xs">{v.icon} {v.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <div className="flex items-center gap-1 shrink-0">
                                <Input type="number" min="0.1" step="1"
                                  value={comp.durationValue}
                                  onChange={e => updateDealComponent(comp.id, { durationValue: parseFloat(e.target.value) || 1 })}
                                  className="h-7 w-14 text-xs text-center" />
                                <div className="flex rounded overflow-hidden border border-slate-200">
                                  {(["heures","jours","semaines","mois"] as DealDurationUnit[]).map(u => (
                                    <button key={u}
                                      onClick={() => updateDealComponent(comp.id, { durationUnit: u })}
                                      className={`h-7 px-1.5 text-[9px] font-medium border-l border-slate-200 first:border-l-0 transition-colors ${comp.durationUnit === u ? "bg-slate-800 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
                                      {DEAL_DURATION_UNIT_META[u].short}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="text-xs font-semibold text-slate-700 w-24 text-right shrink-0">
                                {formatFCFA(Math.round(compResult?.total ?? compRawTotal))}
                              </div>
                              <button onClick={() => removeDealComponent(comp.id)} className="text-slate-300 hover:text-red-400 transition-colors shrink-0">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Expanded: cost items */}
                            {isExpanded && (
                              <div className="px-10 pb-3">
                                <p className="text-[9px] text-muted-foreground mb-2 italic">{DEAL_TYPE_META[comp.dealType].hint}</p>
                                <div className="space-y-1.5">
                                  {(comp.costItems ?? []).map(item => (
                                    <div key={item.id} className="flex items-center gap-1.5">
                                      <Input value={item.label}
                                        onChange={e => updateComponentItem(comp.id, item.id, { label: e.target.value })}
                                        className="h-7 text-xs flex-1 min-w-0" placeholder="Description du coût…" />
                                      <div className="flex rounded overflow-hidden border border-slate-200 shrink-0">
                                        {([{ mode: "fixed" as const, label: "FCFA" }, { mode: "per_unit" as const, label: "/u" }]).map(m => (
                                          <button key={m.mode}
                                            onClick={() => updateComponentItem(comp.id, item.id, { alloc: m.mode })}
                                            className={`h-7 px-2 text-[10px] border-l border-slate-200 first:border-l-0 transition-colors ${item.alloc === m.mode ? "bg-slate-800 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
                                            {m.label}
                                          </button>
                                        ))}
                                      </div>
                                      {item.alloc === "per_unit" && (
                                        <Input type="number" min="0" value={item.qty ?? 1}
                                          onChange={e => updateComponentItem(comp.id, item.id, { qty: parseFloat(e.target.value) || 1 })}
                                          className="h-7 w-14 text-xs text-right shrink-0" placeholder="qté" />
                                      )}
                                      <Input type="number" min="0" value={item.amount}
                                        onChange={e => updateComponentItem(comp.id, item.id, { amount: parseFloat(e.target.value) || 0 })}
                                        className="h-7 w-28 text-xs text-right shrink-0" placeholder="Montant FCFA" />
                                      <button onClick={() => removeComponentItem(comp.id, item.id)} className="text-slate-300 hover:text-red-400 transition-colors shrink-0">
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                                <button onClick={() => addComponentCostItem(comp.id)}
                                  className="mt-2 flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 border border-dashed border-slate-200 rounded px-2 py-1 hover:bg-slate-50 transition-colors">
                                  <Plus className="w-3 h-3" />Ajouter un poste de coût
                                </button>
                                {compResult && (compResult.directCosts > 0 || compResult.structureCost > 0) && (
                                  <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap gap-4 text-[10px] text-muted-foreground">
                                    <span>Directs : <strong className="text-slate-700">{formatFCFA(Math.round(compResult.directCosts))}</strong></span>
                                    {compResult.structureCost > 0 && (
                                      <span>Structure allouée : <strong className="text-slate-700">{formatFCFA(Math.round(compResult.structureCost))}</strong></span>
                                    )}
                                    <span className="font-semibold text-slate-800">= {formatFCFA(Math.round(compResult.total))}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {/* Consolidated footer */}
                      {(scenario.dealComponents ?? []).length > 0 && (
                        <div className="bg-slate-800 px-4 py-2.5 flex items-center justify-between">
                          <span className="text-xs text-slate-300">
                            {(scenario.dealComponents ?? []).length} composante{(scenario.dealComponents ?? []).length > 1 ? "s" : ""} · coût de revient consolidé
                          </span>
                          <span className="text-sm font-bold text-white">
                            {formatFCFA(Math.round(result.byComponentResult.reduce((s, r) => s + r.total, 0)))}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Cost tabs */}
            <Card className="shadow-sm">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <CardHeader className="pb-0 border-b">
                  <TabsList className="w-full h-auto flex flex-wrap gap-1 bg-transparent p-0 pb-3">
                    {(["directs","achats","labor","operations","generaux"] as const).map(v => ({
                      value: v,
                      label: { directs: "Coûts directs", achats: "Achats & Approvisionnement", labor: "Main-d'œuvre", operations: "Opérations", generaux: "Frais de structure" }[v],
                    })).map(t => (
                      <button key={t.value} onClick={() => setActiveTab(t.value)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${activeTab === t.value ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                        {t.label}
                      </button>
                    ))}
                  </TabsList>
                </CardHeader>

                <CardContent className="pt-4">

                  {/* ── Tab: Coûts directs ── */}
                  <TabsContent value="directs" className="mt-0">
                    <CostSection title="directs" icon={Package} color="#3B82F6"
                      items={(scenario.costItems ?? []).filter(i => i.category !== "purchase")}
                      baseCost={result.totalCost} baseHT={result.priceHT}
                      onAdd={() => addItem("costItems", "direct")}
                      onUpdate={(id, u) => updateItem("costItems", id, u)}
                      onRemove={(id) => removeItem("costItems", id)}
                      defaultCategory="direct">
                    </CostSection>
                  </TabsContent>

                  {/* ── Tab: Achats & Approvisionnement ── */}
                  <TabsContent value="achats" className="mt-0 space-y-3">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => addItem("costItems", "purchase")} className="text-xs gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                        <Plus className="w-3.5 h-3.5" />Ajouter un achat
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowInventoryDialog(true)} className="text-xs gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                        <Package className="w-3.5 h-3.5" />Importer depuis Produits / Stock
                      </Button>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-xs text-emerald-800">
                      <strong>Achats & Approvisionnement :</strong> matières premières, fournitures, marchandises, sous-traitance — prix d'achat récupéré automatiquement depuis le catalogue Produits / Stock.
                    </div>
                    <CostSection title="achats" icon={Package} color="#10B981"
                      items={(scenario.costItems ?? []).filter(i => i.category === "purchase")}
                      baseCost={result.totalCost} baseHT={result.priceHT}
                      onAdd={() => addItem("costItems", "purchase")}
                      onUpdate={(id, u) => updateItem("costItems", id, u)}
                      onRemove={(id) => removeItem("costItems", id)}
                      defaultCategory="purchase">
                    </CostSection>
                    {totalPurchaseCost > 0 && (
                      <div className="flex justify-between items-center text-sm border-t border-emerald-100 pt-2">
                        <span className="text-muted-foreground font-medium flex items-center gap-1"><Calculator className="w-3.5 h-3.5" />Total Achats & Approvisionnement</span>
                        <span className="font-bold text-emerald-700">{formatFCFA(Math.round(totalPurchaseCost))}</span>
                      </div>
                    )}
                  </TabsContent>

                  {/* ── Tab: Main-d'œuvre ── */}
                  <TabsContent value="labor" className="mt-0 space-y-3">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={addLaborLine} className="text-xs gap-1 border-purple-200 text-purple-700 hover:bg-purple-50">
                        <Plus className="w-3.5 h-3.5" />Ajouter manuellement
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowHRDialog(true)} className="text-xs gap-1 border-purple-200 text-purple-700 hover:bg-purple-50">
                        <Users className="w-3.5 h-3.5" />Importer depuis les RH
                      </Button>
                    </div>
                    <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 text-xs text-purple-800">
                      <strong>Méthode de calcul :</strong> Coût RH = (Salaire brut × (1 + charges patronales%) + avantages) / heures mensuelles × heures affectées
                    </div>
                    {(scenario.laborLines ?? []).length === 0 ? (
                      <div className="text-center py-8 border border-dashed border-slate-200 rounded-lg text-muted-foreground text-xs">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-20" />
                        Aucune ligne RH — ajoutez manuellement ou importez depuis les collaborateurs
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {(scenario.laborLines ?? []).map(line => (
                          <LaborLineRow key={line.id} line={line} onUpdate={p => updateLaborLine(line.id, p)} onRemove={() => removeLaborLine(line.id)} />
                        ))}
                        <div className="flex justify-between items-center text-sm border-t border-purple-100 pt-2">
                          <span className="text-muted-foreground font-medium flex items-center gap-1"><Calculator className="w-3.5 h-3.5" />Total Main-d'œuvre</span>
                          <span className="font-bold text-purple-700">{formatFCFA(Math.round(totalLaborCost))}</span>
                        </div>
                      </div>
                    )}
                    <div className="border-t border-slate-100 pt-3">
                      <Label className="text-xs text-muted-foreground">Paramètres par défaut (nouveaux collaborateurs)</Label>
                      <div className="grid grid-cols-2 gap-2 mt-1.5">
                        <div>
                          <Label className="text-[10px]">Charges patronales (%)</Label>
                          <Input type="number" min="0" value={scenario.laborSettings.employerChargeRate}
                            onChange={e => updateScenario({ laborSettings: { ...scenario.laborSettings, employerChargeRate: parseFloat(e.target.value) || 0 } })}
                            className="h-7 text-xs mt-0.5" />
                        </div>
                        <div>
                          <Label className="text-[10px]">Heures hebdomadaires</Label>
                          <Input type="number" min="1" value={scenario.laborSettings.weeklyHours}
                            onChange={e => updateScenario({ laborSettings: { ...scenario.laborSettings, weeklyHours: parseFloat(e.target.value) || 40 } })}
                            className="h-7 text-xs mt-0.5" />
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* ── Tab: Opérations ── */}
                  <TabsContent value="operations" className="mt-0 space-y-5">

                    {/* Amortissements & équipements */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <HardHat className="w-4 h-4 text-lime-600" />
                          <span className="font-semibold text-sm text-lime-800">Amortissements & équipements</span>
                          {totalDepr > 0 && <span className="text-xs font-bold text-lime-700 bg-lime-100 px-2 py-0.5 rounded-full">{formatFCFA(Math.round(totalDepr))}</span>}
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setShowEquipDialog(true)} className="text-xs gap-1 border-lime-200 text-lime-700 hover:bg-lime-50 h-7">
                          <HardHat className="w-3.5 h-3.5" />Importer depuis Équipements
                        </Button>
                      </div>

                      {/* Liste des équipements */}
                      {(scenario.depreciationItems ?? []).length === 0 ? (
                        <div className="text-center py-7 text-muted-foreground text-xs border border-dashed border-lime-200 rounded-lg">
                          <HardHat className="w-6 h-6 mx-auto mb-1.5 opacity-30" />
                          <div>Aucun équipement ajouté</div>
                          <div className="text-[10px] mt-0.5">Importez depuis le catalogue ou ajoutez manuellement</div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {(scenario.depreciationItems ?? []).map(item => (
                            <DepreciationItemRow
                              key={item.id} item={item}
                              onUpdate={u => updateItem("depreciationItems", item.id, u)}
                              onRemove={() => removeItem("depreciationItems", item.id)}
                            />
                          ))}
                          {totalDepr > 0 && (
                            <div className="flex justify-between text-xs border-t border-lime-100 pt-2 mt-1 pr-1">
                              <span className="text-muted-foreground font-medium flex items-center gap-1">
                                <Calculator className="w-3 h-3" />Total amortissements
                              </span>
                              <span className="font-bold text-lime-700">{formatFCFA(Math.round(totalDepr))}</span>
                            </div>
                          )}
                        </div>
                      )}

                      <Button size="sm" variant="outline"
                        onClick={() => addItem("depreciationItems", "depreciation", "per_unit", "j")}
                        className="w-full h-7 text-xs border-dashed border-lime-300 text-lime-700 hover:bg-lime-50 mt-2">
                        <Plus className="w-3.5 h-3.5 mr-1" /> Ajouter un équipement manuellement
                      </Button>
                    </div>
                  </TabsContent>

                  {/* ── Tab: Frais de structure ── */}
                  <TabsContent value="generaux" className="mt-0 space-y-4">

                    {/* Mode toggle */}
                    <div className={`flex items-center justify-between p-3.5 rounded-xl border-2 transition-all ${(scenario.structureCosts ?? DEFAULT_STRUCTURE_COSTS).enabled ? "border-slate-700 bg-slate-50" : "border-slate-200 bg-white"}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${(scenario.structureCosts ?? DEFAULT_STRUCTURE_COSTS).enabled ? "bg-slate-800" : "bg-slate-100"}`}>
                          <Calculator className={`w-4 h-4 ${(scenario.structureCosts ?? DEFAULT_STRUCTURE_COSTS).enabled ? "text-white" : "text-slate-400"}`} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-800">Calcul unifié depuis les données réelles</div>
                          <div className="text-[10px] text-muted-foreground">
                            {(scenario.structureCosts ?? DEFAULT_STRUCTURE_COSTS).enabled
                              ? "Actif — quote-part calculée automatiquement depuis vos budgets mensuels"
                              : "Désactivé — renseignez les postes ligne par ligne ci-dessous"}
                          </div>
                        </div>
                      </div>
                      <Switch
                        checked={(scenario.structureCosts ?? DEFAULT_STRUCTURE_COSTS).enabled}
                        onCheckedChange={v => updateStructureCosts({ enabled: v })}
                      />
                    </div>

                    {(scenario.structureCosts ?? DEFAULT_STRUCTURE_COSTS).enabled ? (
                      <UnifiedStructurePanel
                        config={scenario.structureCosts ?? DEFAULT_STRUCTURE_COSTS}
                        onUpdate={updateStructureCosts}
                        ytdCharges={ytdData?.ytdCharges ?? 0}
                        ytdMonthsElapsed={ytdMonthsElapsed}
                        realBurnRates={realBurnRates}
                        ytdRevenues={ytdData?.ytdRevenues ?? 0}
                        priceHT={result.priceHT}
                        directCostsAmount={totalLaborCost + totalDirectCost + totalOperational + totalDepr}
                        periodBurnRate={periodBurnRate}
                      />
                    ) : (
                      <div className="space-y-5">
                        {/* Charges opérationnelles — ligne par ligne */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Wrench className="w-4 h-4 text-sky-500" />
                            <span className="font-semibold text-sm text-sky-800">Charges opérationnelles</span>
                            {result.byCategory.operational > 0 && <span className="text-xs font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full">{formatFCFA(Math.round(result.byCategory.operational))}</span>}
                          </div>
                          <CostSection title="opérationnelles" icon={Wrench} color="#0EA5E9"
                            items={scenario.operationalItems} baseCost={result.totalCost} baseHT={result.priceHT}
                            onAdd={() => addItem("operationalItems", "operational")}
                            onUpdate={(id, u) => updateItem("operationalItems", id, u)}
                            onRemove={(id) => removeItem("operationalItems", id)}
                            defaultCategory="operational">
                            <div className="flex gap-1 mb-2 flex-wrap">
                              {[
                                { label: "Carburant (fix.)", alloc: "fixed" as AllocMethod },
                                { label: "Carburant (%)", alloc: "pct" as AllocMethod },
                                { label: "Par heure", alloc: "per_unit" as AllocMethod, unit: "h" },
                                { label: "Par jour", alloc: "per_unit" as AllocMethod, unit: "j" },
                              ].map((t, i) => (
                                <button key={i} onClick={() => { const item: CostItem = { id: uid(), label: t.label === "Par heure" ? "Ressource/h" : t.label === "Par jour" ? "Ressource/j" : t.label, category: "operational", alloc: t.alloc, amount: 0, qty: t.alloc === "per_unit" ? 1 : undefined, qtyUnit: t.unit }; updateScenario({ operationalItems: [...(scenario.operationalItems ?? []), item] }); }}
                                  className="text-[10px] px-2 py-1 border border-dashed border-sky-300 rounded text-sky-700 hover:bg-sky-50">
                                  <Plus className="w-3 h-3 inline mr-0.5" />{t.label}
                                </button>
                              ))}
                            </div>
                          </CostSection>
                        </div>

                        {/* Admin */}
                        <div className="border-t border-slate-100 pt-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Building2 className="w-4 h-4 text-slate-500" />
                            <span className="font-semibold text-sm text-slate-700">Admin & structure</span>
                            {result.byCategory.admin > 0 && <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">{formatFCFA(Math.round(result.byCategory.admin))}</span>}
                          </div>
                          <CostSection title="admin" icon={Building2} color="#64748B"
                            items={scenario.adminItems} baseCost={result.totalCost} baseHT={result.priceHT}
                            onAdd={() => { const item: CostItem = { id: uid(), label: "Quote-part admin", category: "admin", alloc: "pct", amount: 5, baseRef: "cost" }; updateScenario({ adminItems: [...(scenario.adminItems ?? []), item] }); }}
                            onUpdate={(id, u) => updateItem("adminItems", id, u)}
                            onRemove={(id) => removeItem("adminItems", id)}
                            defaultCategory="admin">
                            <div className="flex gap-1 mb-2 flex-wrap">
                              {[
                                { label: "% coût direct", item: { label: "Quote-part admin", category: "admin" as CostCategory, alloc: "pct" as AllocMethod, amount: 5, baseRef: "cost" as "cost"|"ht" } },
                                { label: "% prix HT", item: { label: "Quote-part admin", category: "admin" as CostCategory, alloc: "pct" as AllocMethod, amount: 3, baseRef: "ht" as "cost"|"ht" } },
                                { label: "Montant fixe", item: { label: "Loyer mensuel", category: "admin" as CostCategory, alloc: "fixed" as AllocMethod, amount: 0 } },
                              ].map((t, i) => (
                                <button key={i} onClick={() => updateScenario({ adminItems: [...(scenario.adminItems ?? []), { id: uid(), ...t.item }] })}
                                  className="text-[10px] px-2 py-1 border border-dashed border-slate-300 rounded text-slate-600 hover:bg-slate-50">
                                  <Plus className="w-3 h-3 inline mr-0.5" />{t.label}
                                </button>
                              ))}
                            </div>
                          </CostSection>
                        </div>

                        {/* Commercial */}
                        <div className="border-t border-slate-100 pt-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Megaphone className="w-4 h-4 text-purple-500" />
                            <span className="font-semibold text-sm text-purple-700">Commercial & marketing</span>
                            {result.byCategory.commercial > 0 && <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">{formatFCFA(Math.round(result.byCategory.commercial))}</span>}
                          </div>
                          <CostSection title="commerciaux" icon={Megaphone} color="#A855F7"
                            items={scenario.commercialItems} baseCost={result.totalCost} baseHT={result.priceHT}
                            onAdd={() => { const item: CostItem = { id: uid(), label: "Commission commerciale", category: "commercial", alloc: "pct", amount: 5, baseRef: "ht" }; updateScenario({ commercialItems: [...(scenario.commercialItems ?? []), item] }); }}
                            onUpdate={(id, u) => updateItem("commercialItems", id, u)}
                            onRemove={(id) => removeItem("commercialItems", id)}
                            defaultCategory="commercial">
                            <div className="flex gap-1 mb-2 flex-wrap">
                              {[
                                { label: "% prix HT", item: { label: "Commission", category: "commercial" as CostCategory, alloc: "pct" as AllocMethod, amount: 5, baseRef: "ht" as "cost"|"ht" } },
                                { label: "% coût", item: { label: "Marketing", category: "commercial" as CostCategory, alloc: "pct" as AllocMethod, amount: 3, baseRef: "cost" as "cost"|"ht" } },
                                { label: "Fixe", item: { label: "Frais prospection", category: "commercial" as CostCategory, alloc: "fixed" as AllocMethod, amount: 0 } },
                              ].map((t, i) => (
                                <button key={i} onClick={() => updateScenario({ commercialItems: [...(scenario.commercialItems ?? []), { id: uid(), ...t.item }] })}
                                  className="text-[10px] px-2 py-1 border border-dashed border-purple-200 rounded text-purple-600 hover:bg-purple-50">
                                  <Plus className="w-3 h-3 inline mr-0.5" />{t.label}
                                </button>
                              ))}
                            </div>
                          </CostSection>
                        </div>

                        {/* Financial */}
                        <div className="border-t border-slate-100 pt-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Banknote className="w-4 h-4 text-red-500" />
                            <span className="font-semibold text-sm text-red-700">Frais financiers</span>
                            {result.byCategory.financial > 0 && <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">{formatFCFA(Math.round(result.byCategory.financial))}</span>}
                          </div>
                          <CostSection title="financiers" icon={Banknote} color="#EF4444"
                            items={scenario.financialItems} baseCost={result.totalCost} baseHT={result.priceHT}
                            onAdd={() => { const item: CostItem = { id: uid(), label: "Frais financiers", category: "financial", alloc: "pct", amount: 1, baseRef: "cost" }; updateScenario({ financialItems: [...(scenario.financialItems ?? []), item] }); }}
                            onUpdate={(id, u) => updateItem("financialItems", id, u)}
                            onRemove={(id) => removeItem("financialItems", id)}
                            defaultCategory="financial" />
                        </div>
                      </div>
                    )}

                    {/* Risk — toujours visible, spécifique au deal */}
                    <div className="border-t border-slate-100 pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="w-4 h-4 text-orange-500" />
                        <span className="font-semibold text-sm text-orange-700">Provisions & risques</span>
                        {totalRisk > 0 && <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">{formatFCFA(Math.round(totalRisk))}</span>}
                        <span className="text-[10px] text-orange-600 bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded">spécifique au deal</span>
                      </div>
                      <div className="bg-orange-50 border border-orange-100 rounded-lg p-2.5 mb-2 text-xs text-orange-700">
                        Garanties, retours, impayés, pertes, marge de sécurité… Toujours en mode détail car ces provisions sont propres à chaque deal.
                      </div>
                      <CostSection title="risques" icon={Shield} color="#F97316"
                        items={scenario.riskItems} baseCost={result.totalCost} baseHT={result.priceHT}
                        onAdd={() => { const item: CostItem = { id: uid(), label: "Provision risques", category: "risk", alloc: "pct", amount: 3, baseRef: "cost" }; updateScenario({ riskItems: [...(scenario.riskItems ?? []), item] }); }}
                        onUpdate={(id, u) => updateItem("riskItems", id, u)}
                        onRemove={(id) => removeItem("riskItems", id)}
                        defaultCategory="risk">
                        <div className="flex gap-1 mb-2 flex-wrap">
                          {[2, 3, 5, 10].map(pct => (
                            <button key={pct} onClick={() => updateScenario({ riskItems: [...(scenario.riskItems ?? []), { id: uid(), label: `Provision risques (${pct}%)`, category: "risk", alloc: "pct", amount: pct, baseRef: "cost" }] })}
                              className="text-[10px] px-2 py-1 border border-dashed border-orange-200 rounded text-orange-600 hover:bg-orange-50">
                              <Plus className="w-3 h-3 inline mr-0.5" />+{pct}% risque
                            </button>
                          ))}
                        </div>
                      </CostSection>
                    </div>
                  </TabsContent>
                </CardContent>
              </Tabs>
            </Card>

            {/* Marge & TVA */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[#2563EB]" />Marge cible & TVA</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Mode de calcul du prix</Label>
                    <Select value={scenario.marginMode} onValueChange={v => updateScenario({ marginMode: v as MarginMode })}>
                      <SelectTrigger className="h-8 mt-1 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(MARGIN_MODES).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            <div><div className="font-medium text-xs">{v.label}</div><div className="text-[10px] text-muted-foreground">{v.desc}</div></div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">{scenario.marginMode === "markup" ? "Coefficient (%)" : scenario.marginMode === "net" ? "Marge nette cible (%)" : "Marge brute cible (%)"}</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input type="number" min="0" step="0.5" value={scenario.marginTarget} onChange={e => updateScenario({ marginTarget: parseFloat(e.target.value) || 0 })} className="flex-1 h-8 text-xs" />
                      <span className="text-sm font-semibold text-muted-foreground">%</span>
                    </div>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {(scenario.marginMode === "markup" ? [20,30,40,50] : [10,15,20,25,33]).map(v => (
                        <Button key={v} size="sm" variant="outline" className={`h-6 text-xs px-2 ${scenario.marginTarget === v ? "bg-[#2563EB] text-white border-[#2563EB]" : ""}`} onClick={() => updateScenario({ marginTarget: v })}>{v}%</Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Taux de TVA (%)</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input type="number" min="0" max="50" step="0.5" value={scenario.taxRate} onChange={e => updateScenario({ taxRate: parseFloat(e.target.value) || 0 })} className="flex-1 h-8 text-xs" />
                      <span className="text-sm font-semibold text-muted-foreground">%</span>
                    </div>
                    <div className="flex gap-1 mt-1.5">
                      {[0,10,18,20].map(v => <Button key={v} size="sm" variant="outline" className={`h-6 text-xs px-2 ${scenario.taxRate === v ? "bg-[#2563EB] text-white border-[#2563EB]" : ""}`} onClick={() => updateScenario({ taxRate: v })}>{v === 0 ? "Exonéré" : `${v}%`}</Button>)}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Application de la TVA</Label>
                    <div className="flex gap-2 mt-1">
                      <Button size="sm" variant={scenario.taxMode === "on_top" ? "default" : "outline"} className={`flex-1 text-xs h-8 ${scenario.taxMode === "on_top" ? "bg-[#2563EB] text-white" : ""}`} onClick={() => updateScenario({ taxMode: "on_top" })}>TVA en sus</Button>
                      <Button size="sm" variant={scenario.taxMode === "included" ? "default" : "outline"} className={`flex-1 text-xs h-8 ${scenario.taxMode === "included" ? "bg-[#2563EB] text-white" : ""}`} onClick={() => updateScenario({ taxMode: "included" })}>TVA incluse</Button>
                    </div>
                  </div>

                  {/* Remise commerciale */}
                  <div className="col-span-2 border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <Label className="text-xs flex items-center gap-1.5">
                        <Tag className="w-3 h-3 text-red-500" />
                        Remise commerciale (%)
                      </Label>
                      {(scenario.discountPct ?? 0) > 0 && result.priceHTBrut > 0 && (
                        <span className="text-[10px] text-red-600 font-semibold bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
                          −{formatFCFA(Math.round(result.discountAmount))} · marge brute après remise : {result.grossMarginPct.toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number" min="0" max="100" step="0.5"
                        value={scenario.discountPct ?? 0}
                        onChange={e => updateScenario({ discountPct: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })}
                        className="flex-1 h-8 text-xs"
                        placeholder="0"
                      />
                      <span className="text-sm font-semibold text-muted-foreground">%</span>
                    </div>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {[0, 5, 10, 15, 20].map(v => (
                        <Button key={v} size="sm" variant="outline"
                          className={`h-6 text-xs px-2 ${(scenario.discountPct ?? 0) === v ? "bg-red-500 text-white border-red-500" : ""}`}
                          onClick={() => updateScenario({ discountPct: v })}>
                          {v === 0 ? "Aucune" : `−${v}%`}
                        </Button>
                      ))}
                    </div>
                    {(scenario.discountPct ?? 0) > 0 && result.priceHTBrut > 0 && (
                      <div className="mt-2 text-[10px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                        Prix catalogue : <strong>{formatFCFA(Math.round(result.priceHTBrut))}</strong> → remise {(scenario.discountPct ?? 0)}% → Prix HT facturé : <strong className="text-slate-800">{formatFCFA(Math.round(result.priceHT))}</strong>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* IS */}
            <Card className={`shadow-sm ${fiscalConfig.enabled ? "border-orange-200" : ""}`}>
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-orange-500" />Impôt sur les sociétés (IS)
                    <Tooltip><TooltipTrigger asChild><Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" /></TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">IS calculé depuis le barème configuré dans Comptabilité → Fiscal. Bénéfice YTD projeté = résultat net YTD + résultat net estimé de ce deal.</TooltipContent>
                    </Tooltip>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {loadingYtd ? <span className="text-xs text-muted-foreground">Chargement…</span> :
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${fiscalConfig.enabled ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500"}`}>
                        {fiscalConfig.enabled ? "Activé" : "Désactivé"}
                      </span>}
                    <a href="/comptabilite/taxes" className="text-xs text-orange-600 underline hover:text-orange-800">Configurer →</a>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="space-y-1.5">
                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">A — Résultat net YTD actuel (comptabilité)</span>
                      {ytdData?.period?.from && <span className="text-[10px] text-muted-foreground">depuis {ytdData.period.from}</span>}
                    </div>
                    {loadingYtd ? <div className="text-xs text-muted-foreground">Calcul…</div> : (
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div><div className="text-muted-foreground mb-0.5">Résultat brut</div><div className={`font-bold text-sm ${fiscalConfig.ytdProfitBeforeTax < 0 ? "text-red-600" : "text-slate-800"}`}>{formatFCFA(Math.round(fiscalConfig.ytdProfitBeforeTax))}</div></div>
                        <div><div className="text-muted-foreground mb-0.5">IS actuel estimé</div><div className="font-bold text-sm text-orange-600">{fiscalConfig.enabled ? `− ${formatFCFA(Math.round(fiscalConfig.ytdEstimatedTax))}` : <span className="text-slate-400">—</span>}</div></div>
                        <div><div className="text-muted-foreground mb-0.5">Résultat net</div><div className={`font-bold text-sm ${fiscalConfig.ytdNetProfit < 0 ? "text-red-600" : "text-emerald-700"}`}>{formatFCFA(Math.round(fiscalConfig.ytdNetProfit))}</div></div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 px-1"><div className="h-px flex-1 bg-slate-100"/><span className="text-slate-400 font-bold text-sm">+</span><div className="h-px flex-1 bg-slate-100"/></div>
                  <div className={`border rounded-lg p-3 ${result.netProfit < 0 ? "bg-red-50 border-red-100" : "bg-blue-50 border-blue-100"}`}>
                    <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">B — Résultat net deal simulé</div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div><div className="text-muted-foreground mb-0.5">Marge brute</div><div className={`font-bold text-sm ${result.grossMargin < 0 ? "text-red-600" : "text-slate-700"}`}>{result.totalCost > 0 ? formatFCFA(Math.round(result.grossMargin)) : "—"}</div></div>
                      <div><div className="text-muted-foreground mb-0.5">IS incrémental</div><div className="font-bold text-sm text-orange-600">{fiscalConfig.enabled && result.corporateTax > 0 ? `− ${formatFCFA(Math.round(result.corporateTax))}` : <span className="text-slate-400">—</span>}</div></div>
                      <div><div className="text-muted-foreground mb-0.5">Résultat net</div><div className={`font-bold text-sm ${result.netProfit < 0 ? "text-red-600" : "text-blue-700"}`}>{result.totalCost > 0 ? formatFCFA(Math.round(result.netProfit)) : "—"}</div></div>
                    </div>
                    {fiscalConfig.enabled && result.corporateTax > 0 && (
                      <div className="flex gap-4 mt-2 text-[10px] text-muted-foreground">
                        <span>Taux effectif : <strong className="text-orange-700">{result.effectiveTaxRate.toFixed(1)}%</strong></span>
                        <span>Taux marginal : <strong className="text-orange-700">{result.marginalTaxRate.toFixed(1)}%</strong></span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 px-1"><div className="h-px flex-1 bg-slate-100"/><span className="text-slate-400 font-bold text-sm">=</span><div className="h-px flex-1 bg-slate-100"/></div>
                  {(() => {
                    const proj = fiscalConfig.ytdNetProfit + result.netProfit;
                    const pos = proj >= 0;
                    return (
                      <div className={`rounded-lg p-3 border-2 ${pos ? "bg-amber-50 border-amber-300" : "bg-red-50 border-red-300"}`}>
                        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">C — Bénéfice YTD projeté</div>
                        <div className={`text-2xl font-black ${pos ? "text-amber-700" : "text-red-700"}`}>
                          {result.totalCost > 0 ? formatFCFA(Math.round(proj)) : <span className="text-base font-semibold text-slate-400">Saisir un coût pour calculer</span>}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          = Résultat net YTD ({formatFCFA(Math.round(fiscalConfig.ytdNetProfit))}) + Résultat net deal ({result.totalCost > 0 ? formatFCFA(Math.round(result.netProfit)) : "—"})
                        </div>
                      </div>
                    );
                  })()}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[10px] text-muted-foreground">Barème IS :</span>
                    <span className="text-[10px] font-medium text-slate-700">{fiscalConfig.brackets.length} tranches — {fiscalConfig.brackets.map(b => `${b.rate}%`).join(" · ")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ══ RIGHT PANEL ══ */}
          <div className="col-span-12 lg:col-span-5 space-y-4">

            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white rounded-xl p-4 shadow">
                <div className="text-xs text-slate-400 font-medium mb-1">Coût de revient complet</div>
                <div className="text-xl font-bold">{formatFCFA(result.totalCost)}</div>
                {scenario.quantity > 1 && <div className="text-xs text-slate-400 mt-0.5">Unit. : {formatFCFA(result.unitCost)}</div>}
              </div>
              <div className="bg-gradient-to-br from-[#2563EB] to-[#a8862f] text-white rounded-xl p-4 shadow">
                <div className="text-xs text-amber-100 font-medium mb-1">Prix de vente HT</div>
                {result.discountAmount > 0 && (
                  <div className="text-xs text-amber-200 line-through leading-none mb-0.5">{formatFCFA(Math.round(result.priceHTBrut))}</div>
                )}
                <div className="text-xl font-bold">{formatFCFA(Math.round(result.priceHT))}</div>
                {result.discountAmount > 0 && (
                  <div className="text-[10px] text-amber-100 mt-0.5">Remise {(scenario.discountPct ?? 0)}% : −{formatFCFA(Math.round(result.discountAmount))}</div>
                )}
                {scenario.quantity > 1 && !result.discountAmount && <div className="text-xs text-amber-100 mt-0.5">Unit. : {formatFCFA(Math.round(result.unitHT))}</div>}
              </div>
              <div className="bg-blue-600 text-white rounded-xl p-4 shadow">
                <div className="text-xs text-blue-100 font-medium mb-1">TVA ({scenario.taxRate}%)</div>
                <div className="text-xl font-bold">{formatFCFA(result.taxAmount)}</div>
              </div>
              <div className="bg-emerald-600 text-white rounded-xl p-4 shadow">
                <div className="text-xs text-emerald-100 font-medium mb-1">Prix de vente TTC</div>
                <div className="text-xl font-bold">{formatFCFA(result.priceTTC)}</div>
                {scenario.quantity > 1 && <div className="text-xs text-emerald-100 mt-0.5">Unit. : {formatFCFA(result.unitTTC)}</div>}
              </div>
            </div>

            {/* Cost breakdown chart */}
            {result.totalCost > 0 && (
              <Card className="shadow-sm">
                <CardHeader className="pb-2 border-b">
                  <CardTitle className="text-sm flex items-center gap-2"><Package className="w-4 h-4 text-[#2563EB]" />Décomposition du coût</CardTitle>
                </CardHeader>
                <CardContent className="pt-3">
                  <div className="grid grid-cols-2 gap-2">
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={result.breakdownLabels} dataKey="value" cx="50%" cy="50%" outerRadius={65} innerRadius={30}>
                          {result.breakdownLabels.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <RechartTooltip formatter={(v: number) => formatFCFA(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1 py-2 overflow-y-auto max-h-40">
                      {result.breakdownLabels.map((e, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                            <span className="truncate max-w-[90px] text-slate-600">{e.label}</span>
                          </span>
                          <span className="font-semibold text-slate-700">{result.priceHT > 0 ? `${((e.value / result.priceHT) * 100).toFixed(1)}%` : "—"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Bar breakdown */}
                  <div className="mt-2 space-y-1.5">
                    {result.breakdownLabels.map((e, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-28 truncate shrink-0">{e.label}</span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${result.totalCost > 0 ? (e.value / result.totalCost) * 100 : 0}%`, backgroundColor: e.color }} />
                        </div>
                        <span className="text-xs font-semibold text-slate-700 w-20 text-right shrink-0">{formatFCFA(e.value)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Income statement */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2 border-b">
                <CardTitle className="text-sm font-semibold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[#2563EB]" />Compte de résultat synthétique</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs">
                  <tbody>
                    <tr className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 text-slate-600 font-medium">Chiffre d'affaires HT</td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-800">{formatFCFA(Math.round(result.priceHT))}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">100%</td>
                    </tr>
                    {result.discountAmount > 0 && (
                      <tr className="border-b border-slate-100 hover:bg-red-50/20">
                        <td className="px-4 py-1.5 text-red-500 pl-6">— Remise commerciale ({(scenario.discountPct ?? 0)}%)</td>
                        <td className="px-4 py-1.5 text-right text-red-600 font-semibold">−{formatFCFA(Math.round(result.discountAmount))}</td>
                        <td className="px-4 py-1.5 text-right text-red-400">{result.priceHTBrut > 0 ? `${((result.discountAmount / result.priceHTBrut) * 100).toFixed(1)}%` : "—"}</td>
                      </tr>
                    )}
                    {[
                      { label: "— Coûts directs", val: result.byCategory.direct + result.byCategory.logistics + result.byCategory.tax_input + result.byCategory.other },
                      { label: "— Achats & Approvisionnement", val: result.byCategory.purchase },
                      { label: "— Main-d'œuvre", val: result.byCategory.labor },
                      { label: "— Charges opérat.", val: result.byCategory.operational },
                      { label: "— Amortissements", val: result.byCategory.depreciation },
                      { label: "— Admin & structure", val: result.byCategory.admin },
                      { label: "— Frais commerciaux", val: result.byCategory.commercial },
                      { label: "— Frais financiers", val: result.byCategory.financial },
                      { label: "— Provisions/risques", val: result.byCategory.risk },
                    ].filter(r => r.val > 0).map((row, i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/30">
                        <td className="px-4 py-1.5 text-slate-500 pl-6">{row.label}</td>
                        <td className="px-4 py-1.5 text-right text-red-600">{formatFCFA(Math.round(row.val))}</td>
                        <td className="px-4 py-1.5 text-right text-muted-foreground">{result.priceHT > 0 ? `${((row.val / result.priceHT) * 100).toFixed(1)}%` : "—"}</td>
                      </tr>
                    ))}
                    {fiscalConfig.enabled && (
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <td className="px-4 py-2.5 font-bold text-slate-700">Résultat avant IS</td>
                        <td className={`px-4 py-2.5 text-right font-bold ${result.grossMargin < 0 ? "text-red-600" : "text-emerald-700"}`}>{formatFCFA(result.grossMargin)}</td>
                        <td className={`px-4 py-2.5 text-right font-semibold ${result.grossMarginPct < 10 ? "text-red-500" : "text-emerald-600"}`}>{result.grossMarginPct.toFixed(1)}%</td>
                      </tr>
                    )}
                    {fiscalConfig.enabled && (
                      <tr className="border-b border-slate-100 hover:bg-orange-50/20">
                        <td className="px-4 py-2 text-orange-700 pl-6">— IS incrémental ({result.effectiveTaxRate.toFixed(1)}% effectif / {result.marginalTaxRate.toFixed(0)}% marginal)</td>
                        <td className="px-4 py-2 text-right text-orange-700 font-semibold">{formatFCFA(Math.round(result.corporateTax))}</td>
                        <td className="px-4 py-2 text-right text-orange-500">{result.priceHT > 0 ? `${((result.corporateTax / result.priceHT) * 100).toFixed(1)}%` : "—"}</td>
                      </tr>
                    )}
                    <tr className="bg-[#2563EB]/10">
                      <td className="px-4 py-3 font-bold text-[#8a6b2a]">{fiscalConfig.enabled ? "Bénéfice net après IS" : "Marge nette"}</td>
                      <td className={`px-4 py-3 text-right font-bold text-sm ${result.netProfit < 0 ? "text-red-600" : "text-[#2563EB]"}`}>{formatFCFA(result.netProfit)}</td>
                      <td className={`px-4 py-3 text-right font-bold ${result.netMarginPct < 0 ? "text-red-600" : "text-[#2563EB]"}`}>{result.netMarginPct.toFixed(1)}%</td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Per-component breakdown */}
            {result.byComponentResult.length > 0 && (
              <Card className="shadow-sm">
                <CardHeader className="pb-2 border-b">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#2563EB]" />Détail par composante
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-slate-600">Composante</th>
                        <th className="px-4 py-2 text-right font-semibold text-slate-600">Directs</th>
                        <th className="px-4 py-2 text-right font-semibold text-slate-600">Structure</th>
                        <th className="px-4 py-2 text-right font-semibold text-slate-600">Total</th>
                        <th className="px-4 py-2 text-right font-semibold text-slate-600">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.byComponentResult.map(comp => {
                        const sharePct = result.totalCost > 0 ? (comp.total / result.totalCost) * 100 : 0;
                        return (
                          <tr key={comp.id} className="border-b border-slate-100 hover:bg-slate-50/30">
                            <td className="px-4 py-2 text-slate-700 font-medium">
                              <span className="mr-1">{DEAL_TYPE_META[comp.dealType].icon}</span>{comp.label}
                            </td>
                            <td className="px-4 py-2 text-right text-slate-600">{formatFCFA(Math.round(comp.directCosts))}</td>
                            <td className="px-4 py-2 text-right text-slate-500">{comp.structureCost > 0 ? formatFCFA(Math.round(comp.structureCost)) : "—"}</td>
                            <td className="px-4 py-2 text-right font-semibold text-slate-800">{formatFCFA(Math.round(comp.total))}</td>
                            <td className="px-4 py-2 text-right text-muted-foreground">{sharePct.toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                      <tr className="bg-slate-50 border-t border-slate-200">
                        <td className="px-4 py-2 font-bold text-slate-700">Total composantes</td>
                        <td className="px-4 py-2 text-right font-semibold">{formatFCFA(Math.round(result.byComponentResult.reduce((s, r) => s + r.directCosts, 0)))}</td>
                        <td className="px-4 py-2 text-right font-semibold">{formatFCFA(Math.round(result.byComponentResult.reduce((s, r) => s + r.structureCost, 0)))}</td>
                        <td className="px-4 py-2 text-right font-bold text-slate-900">{formatFCFA(Math.round(result.byComponentResult.reduce((s, r) => s + r.total, 0)))}</td>
                        <td className="px-4 py-2 text-right font-semibold text-slate-700">
                          {result.totalCost > 0 ? `${((result.byComponentResult.reduce((s, r) => s + r.total, 0) / result.totalCost) * 100).toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}

            {/* Key metrics */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2 border-b">
                <CardTitle className="text-sm flex items-center gap-2"><Target className="w-4 h-4 text-[#2563EB]" />Indicateurs clés</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-slate-50 rounded-lg p-2.5">
                    <div className="text-xs text-muted-foreground mb-1">Marge sur coût complet</div>
                    <div className={`text-xl font-bold ${result.grossMarginPct < 10 ? "text-red-500" : result.grossMarginPct < 20 ? "text-amber-500" : "text-emerald-600"}`}>{result.grossMarginPct.toFixed(1)}%</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2.5">
                    <div className="text-xs text-muted-foreground mb-1">Marge nette</div>
                    <div className={`text-xl font-bold ${result.netMarginPct < 0 ? "text-red-500" : result.netMarginPct < 10 ? "text-amber-500" : "text-emerald-600"}`}>{result.netMarginPct.toFixed(1)}%</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2.5">
                    <div className="text-xs text-muted-foreground mb-1">Coefficient</div>
                    <div className="text-xl font-bold text-slate-700">{result.totalCost > 0 ? (result.priceHT / result.totalCost).toFixed(2) : "—"}</div>
                  </div>
                </div>

                {fiscalConfig.enabled && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-orange-50 border border-orange-100 rounded-lg p-2.5 text-center">
                      <div className="text-xs text-orange-600 mb-1">Taux effectif IS</div>
                      <div className="text-lg font-bold text-orange-700">{result.effectiveTaxRate.toFixed(1)}%</div>
                      <div className="text-[10px] text-muted-foreground">IS / résultat avant IS</div>
                    </div>
                    <div className="bg-orange-50 border border-orange-100 rounded-lg p-2.5 text-center">
                      <div className="text-xs text-orange-600 mb-1">Taux marginal IS</div>
                      <div className="text-lg font-bold text-orange-700">{result.marginalTaxRate.toFixed(0)}%</div>
                      <div className="text-[10px] text-muted-foreground">Tranche projetée YTD</div>
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Santé de la marge nette</span>
                    <span className={result.netMarginPct < 0 ? "text-red-500 font-semibold" : result.netMarginPct < 10 ? "text-amber-500 font-semibold" : "text-emerald-600 font-semibold"}>
                      {result.netMarginPct < 0 ? "⚠ Déficitaire" : result.netMarginPct < 5 ? "⚠ Critique" : result.netMarginPct < 15 ? "⚠ Faible" : result.netMarginPct < 30 ? "✓ Acceptable" : "✓✓ Bonne"}
                    </span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${result.netMarginPct < 0 ? "bg-red-500" : result.netMarginPct < 15 ? "bg-amber-400" : "bg-emerald-500"}`}
                      style={{ width: `${Math.min(100, Math.max(0, result.netMarginPct))}%` }} />
                  </div>
                </div>

                {/* Prix cibles */}
                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1"><Target className="w-3.5 h-3.5 text-[#2563EB]" />Prix cibles</div>
                  <div className="flex justify-between text-xs bg-red-50 border border-red-100 rounded-lg p-2.5">
                    <span className="text-red-700 font-medium">Prix minimum (seuil de rentabilité)</span>
                    <span className="font-bold text-red-700">{formatFCFA(Math.round(result.minimumPriceHT))} HT</span>
                  </div>
                  <div className="flex justify-between text-xs bg-emerald-50 border border-emerald-100 rounded-lg p-2.5">
                    <span className="text-emerald-700 font-medium">Prix recommandé ({scenario.marginTarget}% marge nette{fiscalConfig.enabled ? " après IS" : ""})</span>
                    <span className="font-bold text-emerald-700">{formatFCFA(Math.round(result.recommendedPriceHT))} HT</span>
                  </div>
                  {result.priceHT > 0 && result.minimumPriceHT > 0 && (
                    <div className="text-xs text-muted-foreground text-center">
                      Marge de sécurité : <strong className={result.priceHT >= result.minimumPriceHT ? "text-emerald-600" : "text-red-600"}>
                        {formatFCFA(Math.round(result.priceHT - result.minimumPriceHT))}
                      </strong> par rapport au seuil
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setSendDocType("proforma")} className="gap-1.5 text-xs flex-1">
                <FileSignature className="w-3.5 h-3.5" />Créer un devis
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSendDocType("order")} className="gap-1.5 text-xs flex-1">
                <ShoppingCart className="w-3.5 h-3.5" />Créer commande
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSendDocType("invoice")} className="gap-1.5 text-xs flex-1 border-[#2563EB] text-[#2563EB] hover:bg-[#2563EB]/10">
                <Banknote className="w-3.5 h-3.5" />Créer facture
              </Button>
            </div>
          </div>
        </div>

        {/* ══ SCENARIOS & RECOMMENDATIONS ══ */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-8">
            <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base flex items-center gap-2"><Calculator className="w-4 h-4 text-[#2563EB]" />Scénarios de pricing automatiques</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {AUTO_SCENARIOS.map(def => <ScenarioCard key={def.key} def={def} scenario={scenario} fc={fiscalConfig} />)}
                </div>
                {result.totalCost > 0 && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left px-3 py-2 text-muted-foreground font-medium">Scénario</th>
                          <th className="text-right px-3 py-2 text-muted-foreground font-medium">Prix HT</th>
                          <th className="text-right px-3 py-2 text-muted-foreground font-medium">Prix TTC</th>
                          <th className="text-right px-3 py-2 text-muted-foreground font-medium">Marge brute</th>
                          {fiscalConfig.enabled && <th className="text-right px-3 py-2 text-muted-foreground font-medium">IS</th>}
                          <th className="text-right px-3 py-2 text-muted-foreground font-medium">Marge nette</th>
                          <th className="text-right px-3 py-2 text-muted-foreground font-medium">Bénéfice net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {AUTO_SCENARIOS.map(def => {
                          const sc = { ...scenario, marginTarget: def.margin };
                          const r = calculate(sc, fiscalConfig);
                          return (
                            <tr key={def.key} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="px-3 py-2 font-semibold" style={{ color: def.color }}>{def.label}</td>
                              <td className="px-3 py-2 text-right font-semibold">{formatFCFA(Math.round(r.priceHT))}</td>
                              <td className="px-3 py-2 text-right">{formatFCFA(Math.round(r.priceTTC))}</td>
                              <td className="px-3 py-2 text-right" style={{ color: def.color }}>{r.grossMarginPct.toFixed(1)}%</td>
                              {fiscalConfig.enabled && <td className="px-3 py-2 text-right text-orange-600">{formatFCFA(Math.round(r.corporateTax))}</td>}
                              <td className="px-3 py-2 text-right font-bold" style={{ color: def.color }}>{r.netMarginPct.toFixed(1)}%</td>
                              <td className="px-3 py-2 text-right font-bold">{formatFCFA(Math.round(r.netProfit))}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="col-span-12 lg:col-span-4">
            <Card className="shadow-sm h-full">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base flex items-center gap-2"><Lightbulb className="w-4 h-4 text-[#2563EB]" />Recommandations</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-2.5">
                {recommendations.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-xs">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-300" />Aucune alerte — pricing optimal
                  </div>
                ) : recommendations.map((rec, i) => {
                  const colors: Record<RecType, string> = {
                    danger:  "bg-red-50 border-red-200 text-red-800",
                    warning: "bg-amber-50 border-amber-200 text-amber-800",
                    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
                    info:    "bg-blue-50 border-blue-200 text-blue-800",
                  };
                  const icons: Record<RecType, React.ReactNode> = {
                    danger:  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />,
                    warning: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />,
                    success: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />,
                    info:    <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />,
                  };
                  return (
                    <div key={i} className={`border rounded-lg p-3 text-xs ${colors[rec.type]}`}>
                      <div className="flex gap-2">
                        {icons[rec.type]}
                        <div>
                          <div className="font-bold mb-0.5">{rec.title}</div>
                          <div className="opacity-90">{rec.msg}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Reset confirm ── */}
        <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-amber-500" />
                Réinitialiser le scénario
              </DialogTitle>
              <DialogDescription>
                Toutes les lignes de coûts, les paramètres de marge et les informations générales du scénario <strong>«&nbsp;{scenario.name}&nbsp;»</strong> seront effacés. Cette action est irréversible.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowResetConfirm(false)}>Annuler</Button>
              <Button variant="destructive" onClick={resetScenario} className="gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" />Réinitialiser
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Dialogs ── */}
        <LoadFromHRDialog open={showHRDialog} onClose={() => setShowHRDialog(false)}
          laborSettings={scenario.laborSettings}
          onSelect={lines => updateScenario({ laborLines: [...(scenario.laborLines ?? []), ...lines] })} />
        <LoadFromEquipmentDialog open={showEquipDialog} onClose={() => setShowEquipDialog(false)}
          onSelect={items => updateScenario({ depreciationItems: [...(scenario.depreciationItems ?? []), ...items] })} />
        <LoadFromInventoryDialog open={showInventoryDialog} onClose={() => setShowInventoryDialog(false)}
          onSelect={items => updateScenario({ costItems: [...(scenario.costItems ?? []), ...items] })} />
        {sendDocType && (
          <SendToDocDialog open={true} onClose={() => setSendDocType(null)} result={result} scenario={scenario} docType={sendDocType} />
        )}

        {/* ── Dialog : Mes scénarios sauvegardés ── */}
        <Dialog open={showScenarioList} onOpenChange={setShowScenarioList}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-[#2563EB]" />
                Mes scénarios sauvegardés
              </DialogTitle>
              <DialogDescription>Chargez un scénario pour l'ouvrir dans le calculateur.</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-2 py-2">
              {savedScenariosMeta.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">Aucun scénario sauvegardé</p>
                  <p className="text-xs mt-1 opacity-70">Cliquez sur « Enregistrer » pour sauvegarder le scénario actuel.</p>
                </div>
              ) : (
                savedScenariosMeta.map(s => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 group">
                    <div className="w-8 h-8 rounded-lg bg-[#2563EB]/10 flex items-center justify-center shrink-0">
                      <Calculator className="w-4 h-4 text-[#2563EB]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{s.name}</div>
                      {s.productName && <div className="text-xs text-muted-foreground truncate">{s.productName}</div>}
                      <div className="flex items-center gap-2 mt-0.5">
                        {s.clientName && <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{s.clientName}</span>}
                        {s.shareEnabled && <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded flex items-center gap-0.5"><Link2 className="w-2.5 h-2.5" />Partagé</span>}
                        <span className="text-[10px] text-muted-foreground">Modifié le {new Date(s.updatedAt).toLocaleDateString("fr-FR")}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {s.id === savedId && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Actif</span>
                      )}
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                        onClick={() => loadSavedScenario(s.id)}>
                        <Eye className="w-3 h-3" />Charger
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
                        onClick={async () => {
                          await apiFetch(`/api/pricing/scenarios/${s.id}`, { method: "DELETE" });
                          setSavedScenariosMeta(prev => prev.filter(x => x.id !== s.id));
                          if (savedId === s.id) setSavedId(null);
                          toast.success("Scénario supprimé");
                        }}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowScenarioList(false)}>Fermer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Dialog : Partager ── */}
        <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-[#2563EB]" />
                Partager le scénario
              </DialogTitle>
              <DialogDescription>
                Partagez un lien en lecture seule de ce scénario avec un client ou collaborateur.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* Toggle partage */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
                <div>
                  <div className="text-sm font-semibold">Lien de partage</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {shareEnabled ? "Le lien est actif — toute personne avec le lien peut voir ce scénario" : "Activez le partage pour générer un lien"}
                  </div>
                </div>
                <Switch checked={shareEnabled} onCheckedChange={() => toggleShare()} />
              </div>

              {/* Lien copiable */}
              {shareEnabled && shareUrl && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-slate-100 text-xs text-slate-700 font-mono truncate border border-slate-200">
                      {shareUrl}
                    </div>
                    <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={copyShareLink}>
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedLink ? "Copié !" : "Copier"}
                    </Button>
                  </div>
                  <Button size="sm" variant="ghost" className="w-full gap-1.5 text-xs text-muted-foreground"
                    onClick={() => window.open(shareUrl, "_blank")}>
                    <ExternalLink className="w-3.5 h-3.5" />Ouvrir le lien dans un nouvel onglet
                  </Button>
                </div>
              )}

              {/* Info PDF */}
              <div className="border border-slate-100 rounded-lg p-3 bg-slate-50/50 text-xs text-muted-foreground space-y-1">
                <div className="font-medium text-slate-700 mb-1">Vous pouvez aussi :</div>
                <div className="flex items-center gap-2">
                  <Upload className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                  <span>Exporter un PDF professionnel et l'envoyer par email</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileSignature className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                  <span>Convertir en devis via le bouton « Créer un devis »</span>
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowShareDialog(false)}>Fermer</Button>
              <Button onClick={exportPDF} className="gap-1.5 bg-[#2563EB] hover:bg-[#1d4ed8] text-white">
                <Upload className="w-3.5 h-3.5" />Exporter PDF
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Dialog : Comparer des scénarios ── */}
        <Dialog open={showCompareDialog} onOpenChange={setShowCompareDialog}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-[#2563EB]" />
                Comparer des scénarios
              </DialogTitle>
              <DialogDescription>
                Comparaison des résultats de pricing côte à côte.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto">
              {savedScenariosMeta.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  <GitCompare className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">Aucun scénario sauvegardé</p>
                  <p className="text-xs mt-1 opacity-70">Enregistrez au moins deux scénarios pour les comparer.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white">
                        <th className="text-left px-4 py-3 font-semibold w-40">Indicateur</th>
                        {savedScenariosMeta.slice(0, 4).map(s => (
                          <th key={s.id} className={`text-center px-3 py-3 font-semibold ${s.id === savedId ? "text-[#2563EB]" : "text-white"}`}>
                            <div className="truncate max-w-[140px] mx-auto">{s.name}</div>
                            {s.productName && <div className="text-[9px] font-normal text-slate-400 truncate max-w-[140px] mx-auto">{s.productName}</div>}
                            {s.id === savedId && <div className="text-[9px] font-medium text-[#2563EB] mt-0.5">● Actif</div>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: "Client", key: "clientName", fmt: (v: any) => v ?? "—" },
                        { label: "Modifié le", key: "updatedAt", fmt: (v: any) => new Date(v).toLocaleDateString("fr-FR") },
                        { label: "Partage", key: "shareEnabled", fmt: (v: any) => v ? "✓ Actif" : "Désactivé" },
                      ].map((row, i) => (
                        <tr key={row.key} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                          <td className="px-4 py-2.5 text-muted-foreground font-medium">{row.label}</td>
                          {savedScenariosMeta.slice(0, 4).map(s => (
                            <td key={s.id} className="px-3 py-2.5 text-center">
                              {row.fmt((s as any)[row.key])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
                    <Info className="w-3.5 h-3.5 inline mr-1" />
                    Pour voir les montants comparés côte à côte, chargez chaque scénario dans le calculateur et notez les résultats. Les données complètes sont disponibles dans chaque PDF.
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCompareDialog(false)}>Fermer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </TooltipProvider>
  );
}
