import React, { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PieChart, Pie, Cell, Tooltip as RechartTooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { formatFCFA } from "@/lib/format";
import {
  Plus, Trash2, Tag, Info, Copy, FileSignature, ShoppingCart, Save, Download,
  RotateCcw, TrendingUp, AlertCircle, CheckCircle2, Percent, Package, Truck,
  Users, Wrench, DollarSign, ArrowRight, Search, BookOpen, X, Clock, HardHat,
  Calculator, ChevronDown, ChevronUp, Lightbulb, Target, Brain, Landmark,
  TrendingDown, AlertTriangle, Zap, Shield,
} from "lucide-react";
import { toast } from "sonner";

const uid = () => crypto.randomUUID().slice(0, 8);

// ─── Types ────────────────────────────────────────────────────────────────────

type CostCategory = "direct" | "labor" | "indirect" | "logistics" | "purchase" | "tax_input" | "other";
type MarginMode = "net" | "gross" | "markup";
type TaxMode = "on_top" | "included";

interface CostItem {
  id: string;
  label: string;
  category: CostCategory;
  amount: number;
  isPercent?: boolean;
  baseRef?: "cost" | "ht";
}

interface TaxBracket {
  id: string;
  label: string;
  min: number;
  max: number | null;
  rate: number;
}

interface CorporateTaxConfig {
  enabled: boolean;
  ytdProfitBeforeTax: number;
  brackets: TaxBracket[];
}

interface Scenario {
  id: string;
  name: string;
  description: string;
  productName: string;
  costItems: CostItem[];
  laborLines: LaborLineItem[];
  laborSettings: LaborSettings;
  marginMode: MarginMode;
  marginTarget: number;
  taxRate: number;
  taxMode: TaxMode;
  quantity: number;
  corporateTax: CorporateTaxConfig;
}

// ─── Catalog types ────────────────────────────────────────────────────────────

type CatalogProduct = { id: string; sku: string; name: string; unit: string; sellingPriceFcfa: string; taxRatePct: string; isActive: boolean; categoryName?: string };
type CatalogService = { id: string; code: string; name: string; unit: string; unitPrice: string; category: string | null; isActive: boolean };
type CatalogEntry   = { id: string; name: string; ref: string; unit: string; price: number; taxRate: number; kind: "product" | "service" };
type CatalogCollab  = { id: string; firstName: string; lastName: string; position?: string | null; department?: string | null; baseSalary?: string | null; employmentStatus: string };

// ─── Main-d'œuvre types ───────────────────────────────────────────────────────

interface LaborSettings {
  employerChargeRate: number;
  weeklyHours: number;
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

// ─── Recommendation type ──────────────────────────────────────────────────────

type RecType = "danger" | "warning" | "success" | "info";
interface Recommendation {
  type: RecType;
  title: string;
  msg: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: Record<CostCategory, { label: string; icon: React.FC<any>; color: string }> = {
  direct:    { label: "Coûts directs",     icon: Package,      color: "#3B82F6" },
  labor:     { label: "Main d'œuvre",      icon: Users,        color: "#8B5CF6" },
  logistics: { label: "Logistique",        icon: Truck,        color: "#F59E0B" },
  purchase:  { label: "Achats & approv.",  icon: ShoppingCart, color: "#10B981" },
  indirect:  { label: "Frais indirects",   icon: Wrench,       color: "#6B7280" },
  tax_input: { label: "Taxes & droits",    icon: Percent,      color: "#EF4444" },
  other:     { label: "Autres frais",      icon: DollarSign,   color: "#EC4899" },
};

const MARGIN_MODES: Record<MarginMode, { label: string; desc: string }> = {
  net:    { label: "Marge nette souhaitée",      desc: "% du prix de vente HT restant après tous les coûts" },
  gross:  { label: "Marge brute souhaitée",      desc: "% du prix de vente HT avant charges indirectes" },
  markup: { label: "Coefficient de majoration",  desc: "Multiplicateur appliqué au prix de revient (ex. ×1.4 = +40%)" },
};

const CHART_COLORS = ["#3B82F6", "#8B5CF6", "#F59E0B", "#10B981", "#6B7280", "#EF4444", "#EC4899", "#C8A24B"];

const DEFAULT_LABOR_SETTINGS: LaborSettings = { employerChargeRate: 18.4, weeklyHours: 40 };

// Barème IS Togo (BIC) — configurable
const DEFAULT_TAX_BRACKETS: TaxBracket[] = [
  { id: "b1", label: "Exonération",           min: 0,          max: 2_000_000,  rate: 0 },
  { id: "b2", label: "Tranche 1 (2M–10M)",    min: 2_000_001,  max: 10_000_000, rate: 15 },
  { id: "b3", label: "Tranche 2 (10M–50M)",   min: 10_000_001, max: 50_000_000, rate: 25 },
  { id: "b4", label: "Tranche supérieure",    min: 50_000_001, max: null,        rate: 29 },
];

// ─── PricingResult ────────────────────────────────────────────────────────────

interface PricingResult {
  // Coûts
  totalCost: number;
  byCategory: Record<CostCategory, number>;
  // Prix
  priceHT: number;
  priceTTC: number;
  taxAmount: number;           // TVA
  unitCost: number;
  unitHT: number;
  unitTTC: number;
  // Marges
  grossMargin: number;          // CA - coûts totaux
  grossMarginPct: number;
  operatingMargin: number;      // = grossMargin (simplifié)
  operatingMarginPct: number;
  profitBeforeTax: number;      // = grossMargin
  // IS
  corporateTax: number;         // IS incrémental sur ce deal
  effectiveTaxRate: number;     // % effectif (IS/profitBeforeTax)
  marginalTaxRate: number;      // taux marginal applicable
  // Net
  netProfit: number;
  netMarginPct: number;
  // Marges synthétiques (legacy)
  netMargin: number;
  markupPct: number;
  // Prix cibles
  minimumPriceHT: number;       // prix min pour couvrir coûts + IS
  recommendedPriceHT: number;   // prix pour atteindre marginTarget net after IS
}

// ─── Default scenario ─────────────────────────────────────────────────────────

const DEFAULT_SCENARIO: Scenario = {
  id: "default",
  name: "Scénario 1",
  description: "",
  productName: "",
  costItems: [{ id: "c1", label: "Matériaux / Fournitures", category: "direct", amount: 0 }],
  laborLines: [],
  laborSettings: { ...DEFAULT_LABOR_SETTINGS },
  marginMode: "net",
  marginTarget: 25,
  taxRate: 18,
  taxMode: "on_top",
  quantity: 1,
  corporateTax: {
    enabled: false,
    ytdProfitBeforeTax: 0,
    brackets: DEFAULT_TAX_BRACKETS,
  },
};

// ─── Calcul IS ────────────────────────────────────────────────────────────────

function computeTaxOnProfit(profit: number, brackets: TaxBracket[]): number {
  if (profit <= 0) return 0;
  let tax = 0;
  const sorted = [...brackets].sort((a, b) => a.min - b.min);
  for (const b of sorted) {
    if (profit <= b.min) break;
    const upper = b.max === null ? profit : Math.min(profit, b.max);
    const taxable = upper - b.min;
    tax += taxable * (b.rate / 100);
  }
  return tax;
}

function computeCorporateTax(
  ytdProfit: number,
  newProfit: number,
  brackets: TaxBracket[],
): { incrementalTax: number; effectiveRate: number; marginalRate: number } {
  const taxBefore = computeTaxOnProfit(Math.max(0, ytdProfit), brackets);
  const taxAfter  = computeTaxOnProfit(Math.max(0, ytdProfit + newProfit), brackets);
  const incrementalTax = Math.max(0, taxAfter - taxBefore);
  const effectiveRate  = newProfit > 0 ? (incrementalTax / newProfit) * 100 : 0;

  // Taux marginal = tranche dans laquelle tombe le résultat projeté
  const totalProfit = ytdProfit + newProfit;
  const sorted = [...brackets].sort((a, b) => a.min - b.min);
  let marginalRate = sorted[sorted.length - 1]?.rate ?? 0;
  for (const b of sorted) {
    if (totalProfit >= b.min && (b.max === null || totalProfit <= b.max)) {
      marginalRate = b.rate;
      break;
    }
  }
  return { incrementalTax, effectiveRate, marginalRate };
}

/** Recherche dichotomique : prix HT pour atteindre une marge nette cible après IS */
function findPriceForNetMargin(
  totalCost: number,
  targetNetMarginPct: number,
  ytdProfit: number,
  brackets: TaxBracket[],
  taxEnabled: boolean,
): number {
  if (totalCost <= 0) return 0;
  let lo = totalCost;
  let hi = totalCost * 20;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const grossMargin = mid - totalCost;
    const isTax = taxEnabled
      ? computeCorporateTax(ytdProfit, grossMargin, brackets).incrementalTax
      : 0;
    const netProfit = grossMargin - isTax;
    const netMarginPct = mid > 0 ? (netProfit / mid) * 100 : 0;
    if (Math.abs(netMarginPct - targetNetMarginPct) < 0.01) break;
    if (netMarginPct < targetNetMarginPct) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// ─── Calculate ────────────────────────────────────────────────────────────────

function computeLaborLineCost(line: LaborLineItem) {
  const monthlyHours = (line.weeklyHours * 52) / 12;
  const monthlyCostEmployeur = line.monthlySalaryBrut * (1 + line.employerChargeRate / 100) + line.benefitsMonthly;
  const hourlyRate = monthlyHours > 0 ? monthlyCostEmployeur / monthlyHours : 0;
  const totalCost  = hourlyRate * line.allocatedHours;
  return { hourlyRate, totalCost, monthlyCostEmployeur };
}

function calculate(scenario: Scenario): PricingResult {
  const qty = Math.max(1, scenario.quantity);
  const byCategory: Record<CostCategory, number> = {
    direct: 0, labor: 0, indirect: 0, logistics: 0, purchase: 0, tax_input: 0, other: 0,
  };

  // 0. Main-d'œuvre
  for (const line of (scenario.laborLines ?? [])) {
    const { totalCost } = computeLaborLineCost(line);
    byCategory.labor += Math.max(0, totalCost);
  }

  // 1. Coûts fixes
  let fixedCost = byCategory.labor;
  for (const item of scenario.costItems.filter(i => !i.isPercent)) {
    const amt = Math.max(0, item.amount);
    byCategory[item.category] += amt;
    fixedCost += amt;
  }

  // 2. Coûts en %
  let percentCost = 0;
  for (const item of scenario.costItems.filter(i => i.isPercent)) {
    const base = item.baseRef === "ht"
      ? (scenario.marginMode === "markup"
          ? fixedCost * (1 + scenario.marginTarget / 100)
          : fixedCost / Math.max(0.01, 1 - scenario.marginTarget / 100))
      : fixedCost;
    const amt = base * (item.amount / 100);
    byCategory[item.category] += amt;
    percentCost += amt;
  }

  const totalCost = fixedCost + percentCost;

  // 3. Prix HT selon mode
  let priceHT = 0;
  if (scenario.marginMode === "markup") {
    priceHT = totalCost * (1 + scenario.marginTarget / 100);
  } else {
    const margin = Math.min(scenario.marginTarget / 100, 0.999);
    priceHT = totalCost / Math.max(0.001, 1 - margin);
  }

  const taxAmount = scenario.taxMode === "on_top"
    ? priceHT * (scenario.taxRate / 100)
    : priceHT * (scenario.taxRate / (100 + scenario.taxRate));
  const priceTTC = scenario.taxMode === "on_top" ? priceHT + taxAmount : priceHT;

  const grossMargin = priceHT - totalCost;
  const grossMarginPct = priceHT > 0 ? (grossMargin / priceHT) * 100 : 0;
  const markupPct = totalCost > 0 ? (grossMargin / totalCost) * 100 : 0;

  // 4. Impôt société incrémental
  const ct = scenario.corporateTax;
  const { incrementalTax, effectiveRate, marginalRate } = ct.enabled
    ? computeCorporateTax(ct.ytdProfitBeforeTax, grossMargin, ct.brackets)
    : { incrementalTax: 0, effectiveRate: 0, marginalRate: 0 };

  const netProfit = grossMargin - incrementalTax;
  const netMarginPct = priceHT > 0 ? (netProfit / priceHT) * 100 : 0;

  // 5. Prix cibles
  const minimumPriceHT = findPriceForNetMargin(totalCost, 0, ct.ytdProfitBeforeTax, ct.brackets, ct.enabled);
  const recommendedPriceHT = findPriceForNetMargin(totalCost, scenario.marginTarget, ct.ytdProfitBeforeTax, ct.brackets, ct.enabled);

  return {
    totalCost, byCategory,
    priceHT, priceTTC, taxAmount,
    unitCost: totalCost / qty, unitHT: priceHT / qty, unitTTC: priceTTC / qty,
    grossMargin, grossMarginPct,
    operatingMargin: grossMargin, operatingMarginPct: grossMarginPct,
    profitBeforeTax: grossMargin,
    corporateTax: incrementalTax,
    effectiveTaxRate: effectiveRate,
    marginalTaxRate: marginalRate,
    netProfit, netMarginPct,
    netMargin: netProfit,
    markupPct,
    minimumPriceHT,
    recommendedPriceHT,
  };
}

// ─── Scénarios automatiques ───────────────────────────────────────────────────

const AUTO_SCENARIOS = [
  { key: "minimum",     label: "Minimum viable", margin: 0,  color: "#EF4444", bg: "bg-red-50",     border: "border-red-200",     text: "text-red-700" },
  { key: "prudent",     label: "Prudent",         margin: 10, color: "#F59E0B", bg: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-700" },
  { key: "recommande",  label: "Recommandé",      margin: 25, color: "#10B981", bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700" },
  { key: "premium",     label: "Premium",         margin: 40, color: "#6366F1", bg: "bg-indigo-50",  border: "border-indigo-200",  text: "text-indigo-700" },
];

// ─── Recommandations automatiques ────────────────────────────────────────────

function generateRecommendations(result: PricingResult, scenario: Scenario): Recommendation[] {
  const recs: Recommendation[] = [];
  const { priceHT, totalCost, grossMarginPct, netMarginPct, netProfit, grossMargin, corporateTax, marginalTaxRate } = result;

  if (totalCost === 0) {
    recs.push({ type: "info", title: "Aucun coût saisi", msg: "Renseignez vos coûts pour obtenir des recommandations pertinentes." });
    return recs;
  }

  if (priceHT < totalCost) {
    recs.push({ type: "danger", title: "Vente à perte", msg: "Ce prix est inférieur au coût de revient — vous vendez à perte. Augmentez immédiatement votre prix ou réduisez vos coûts." });
  } else if (grossMarginPct < 5) {
    recs.push({ type: "danger", title: "Marge critique", msg: "Ce prix couvre à peine les coûts directs. La marge est insuffisante pour absorber les aléas et les charges indirectes." });
  } else if (grossMarginPct < 15) {
    recs.push({ type: "warning", title: "Marge faible", msg: "Ce prix couvre les coûts directs mais la marge reste fragile face aux charges opérationnelles non comptabilisées." });
  }

  if (scenario.corporateTax.enabled) {
    if (grossMargin > 0 && netProfit <= 0) {
      recs.push({ type: "warning", title: "Rentable avant IS, déficitaire après", msg: "Ce prix génère un bénéfice avant impôt mais la charge d'IS le rend déficitaire. Augmentez votre prix ou renégociez les coûts." });
    }
    if (corporateTax > 0 && grossMargin > 0) {
      const taxBurden = (corporateTax / grossMargin) * 100;
      if (taxBurden > 40) {
        recs.push({ type: "warning", title: "Fort impact fiscal", msg: `L'impôt société absorbe ${taxBurden.toFixed(0)}% de votre marge brute sur ce deal. Envisagez des optimisations fiscales.` });
      }
    }
    if (marginalTaxRate > 0) {
      recs.push({ type: "info", title: `Taux marginal IS : ${marginalTaxRate}%`, msg: `Ce deal est soumis au taux marginal de ${marginalTaxRate}%. Toute hausse de prix supplémentaire sera taxée à ce taux.` });
    }
  }

  if (netMarginPct >= scenario.marginTarget && scenario.marginMode === "net") {
    recs.push({ type: "success", title: "Objectif atteint", msg: `Ce prix atteint votre marge nette cible de ${scenario.marginTarget}% ${scenario.corporateTax.enabled ? "après IS" : ""}.` });
  }

  if (result.recommendedPriceHT > priceHT && priceHT > 0) {
    recs.push({ type: "info", title: "Prix recommandé disponible", msg: `Pour atteindre ${scenario.marginTarget}% de marge nette après IS, appliquez ${formatFCFA(Math.round(result.recommendedPriceHT))} HT (actuellement ${formatFCFA(Math.round(priceHT))} HT).` });
  }

  if (grossMarginPct > 80) {
    recs.push({ type: "warning", title: "Marge exceptionnellement élevée", msg: "Une marge supérieure à 80% est inhabituellement haute. Vérifiez que tous les coûts sont bien pris en compte." });
  }

  return recs;
}

// ─── SendToDocDialog ──────────────────────────────────────────────────────────

type DocType = "proforma" | "order";

function SendToDocDialog({ open, onClose, result, scenario, docType }: {
  open: boolean; onClose: () => void; result: PricingResult; scenario: Scenario; docType: DocType;
}) {
  const { data: clientsRes } = useQuery<{ data: { id: string; name: string }[] }>({
    queryKey: ["clients-list"],
    queryFn: () => apiFetch("/api/clients?limit=100"),
    enabled: open,
  });
  const clients = clientsRes?.data ?? [];
  const [clientId, setClientId] = useState("");
  const [useUnit, setUseUnit] = useState(false);
  const [saving, setSaving] = useState(false);

  const amount = useUnit ? result.unitTTC : result.priceTTC;
  const label = docType === "proforma" ? "Créer le devis" : "Créer la commande";
  const endpoint = docType === "proforma" ? "/api/proformas" : "/api/orders";

  const handleCreate = async () => {
    if (!clientId) { toast.error("Sélectionnez un client"); return; }
    setSaving(true);
    try {
      await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({
          clientId,
          totalAmount: Math.round(amount),
          currency: "XOF",
          notes: `[Calculateur tarifaire] ${scenario.productName || "Prestation"} — Coût : ${formatFCFA(result.totalCost)}, Marge brute : ${result.grossMarginPct.toFixed(1)}%, Marge nette : ${result.netMarginPct.toFixed(1)}%, TVA ${scenario.taxRate}%${scenario.corporateTax.enabled ? `, IS : ${formatFCFA(Math.round(result.corporateTax))}` : ""}`,
        }),
      });
      toast.success(docType === "proforma" ? "Devis créé avec succès" : "Commande créée avec succès");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de la création");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {docType === "proforma" ? <FileSignature className="w-5 h-5 text-[#C8A24B]" /> : <ShoppingCart className="w-5 h-5 text-[#C8A24B]" />}
            {docType === "proforma" ? "Créer un devis depuis ce calcul" : "Créer une commande depuis ce calcul"}
          </DialogTitle>
          <DialogDescription>Les données du calculateur seront reportées dans le document commercial.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-sm">
            <div className="font-semibold text-slate-700">{scenario.productName || "Prestation non nommée"}</div>
            <div className="flex justify-between"><span className="text-muted-foreground">Prix HT :</span><span className="font-semibold">{formatFCFA(result.priceHT)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">TVA ({scenario.taxRate}%) :</span><span>{formatFCFA(result.taxAmount)}</span></div>
            {scenario.corporateTax.enabled && result.corporateTax > 0 && (
              <div className="flex justify-between text-orange-700"><span>IS incrémental :</span><span className="font-semibold">{formatFCFA(Math.round(result.corporateTax))}</span></div>
            )}
            <div className="flex justify-between border-t pt-1 mt-1"><span className="font-semibold">Prix TTC :</span><span className="font-bold text-[#C8A24B] text-base">{formatFCFA(result.priceTTC)}</span></div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>Marge nette :</span><span className="font-semibold text-emerald-600">{result.netMarginPct.toFixed(1)}%</span></div>
          </div>
          <div className="space-y-1">
            <Label>Client *</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un client…" /></SelectTrigger>
              <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {scenario.quantity > 1 && (
            <div className="flex gap-2">
              <Button size="sm" variant={!useUnit ? "default" : "outline"} onClick={() => setUseUnit(false)} className={!useUnit ? "bg-[#C8A24B] text-white" : ""}>
                Global ({formatFCFA(result.priceTTC)})
              </Button>
              <Button size="sm" variant={useUnit ? "default" : "outline"} onClick={() => setUseUnit(true)} className={useUnit ? "bg-[#C8A24B] text-white" : ""}>
                Unitaire ({formatFCFA(result.unitTTC)})
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button onClick={handleCreate} disabled={saving || !clientId} className="bg-[#C8A24B] hover:bg-[#b8922b] text-white">
            {saving ? "Création…" : label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── ScenarioSaveDialog ───────────────────────────────────────────────────────

function ScenarioSaveDialog({ scenario, onSave, onClose }: { scenario: Scenario; onSave: (s: Scenario) => void; onClose: () => void }) {
  const [name, setName] = useState(scenario.name);
  const [desc, setDesc] = useState(scenario.description);
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Enregistrer le scénario</DialogTitle>
          <DialogDescription>Donnez un nom à ce scénario pour le retrouver facilement.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1"><Label>Nom *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1"><Label>Description</Label><Textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => { if (!name.trim()) { toast.error("Nom requis"); return; } onSave({ ...scenario, name, description: desc }); onClose(); }} className="bg-[#C8A24B] hover:bg-[#b8922b] text-white">Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── CostItemRow ──────────────────────────────────────────────────────────────

function CostItemRow({ item, onUpdate, onRemove }: { item: CostItem; onUpdate: (i: CostItem) => void; onRemove: () => void }) {
  const cat = CATEGORIES[item.category];
  return (
    <div className="grid grid-cols-[1fr_140px_120px_80px_40px] items-center gap-2 py-1.5 border-b border-slate-100 last:border-0 group">
      <div className="flex items-center gap-1.5 min-w-0">
        <cat.icon className="w-3.5 h-3.5 shrink-0" style={{ color: cat.color }} />
        <Input className="h-7 text-xs border-0 bg-transparent p-0 focus-visible:ring-0 font-medium" placeholder="Libellé du coût…" value={item.label} onChange={(e) => onUpdate({ ...item, label: e.target.value })} />
      </div>
      <Select value={item.category} onValueChange={(v) => onUpdate({ ...item, category: v as CostCategory })}>
        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{Object.entries(CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k} className="text-xs"><span style={{ color: v.color }}>■</span> {v.label}</SelectItem>)}</SelectContent>
      </Select>
      <div className="flex items-center gap-1">
        <Input type="number" min="0" step="any" className="h-7 text-xs w-full text-right" value={item.amount || ""} onChange={(e) => onUpdate({ ...item, amount: parseFloat(e.target.value) || 0 })} />
        <span className="text-xs text-muted-foreground shrink-0">{item.isPercent ? "%" : "XOF"}</span>
      </div>
      <Button size="sm" variant="ghost" className="h-6 w-8 p-0 text-xs text-muted-foreground hover:text-slate-700 border-0 rounded" onClick={() => onUpdate({ ...item, isPercent: !item.isPercent })} title={item.isPercent ? "Passer en montant fixe" : "Passer en pourcentage"}>
        {item.isPercent ? "%" : "F"}
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity" onClick={onRemove}><Trash2 className="w-3.5 h-3.5" /></Button>
    </div>
  );
}

// ─── Custom Tooltip for Pie ───────────────────────────────────────────────────

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      <div className="font-semibold">{p.name}</div>
      <div className="text-[#C8A24B] font-bold">{formatFCFA(p.value)}</div>
      <div className="text-muted-foreground text-xs">{p.payload.pct?.toFixed(1)}%</div>
    </div>
  );
}

// ─── LaborLineRow ─────────────────────────────────────────────────────────────

const CONTRACT_TYPES = ["CDI", "CDD", "Prestation", "Freelance", "Autre"];

function LaborLineRow({ line, onUpdate, onRemove }: { line: LaborLineItem; onUpdate: (l: LaborLineItem) => void; onRemove: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const { hourlyRate, totalCost, monthlyCostEmployeur } = computeLaborLineCost(line);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white hover:border-purple-200 transition-colors">
      <div className="flex items-center gap-2 px-3 py-2 group">
        <HardHat className="w-3.5 h-3.5 text-purple-500 shrink-0" />
        <Input className="h-7 text-xs border-0 bg-transparent p-0 focus-visible:ring-0 font-medium flex-1 min-w-0" placeholder="Nom / poste" value={line.name} onChange={e => onUpdate({ ...line, name: e.target.value })} />
        <div className="flex items-center gap-3 shrink-0 text-xs">
          <span className="hidden sm:flex items-center gap-1 text-muted-foreground"><Clock className="w-3 h-3" /> {line.allocatedHours}h</span>
          <span className="text-purple-700 font-semibold">{formatFCFA(Math.round(hourlyRate))}/h</span>
          <span className="font-bold text-slate-800">{formatFCFA(Math.round(totalCost))}</span>
        </div>
        <button onClick={() => setExpanded(e => !e)} className="p-1 rounded hover:bg-slate-100 text-muted-foreground">
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        <button onClick={onRemove} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Type de contrat</label>
            <Select value={line.contractType} onValueChange={v => onUpdate({ ...line, contractType: v })}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{CONTRACT_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Salaire brut mensuel (XOF)</label>
            <Input type="number" min="0" step="5000" className="h-7 text-xs" placeholder="300 000" value={line.monthlySalaryBrut || ""} onChange={e => onUpdate({ ...line, monthlySalaryBrut: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              Charges patronales (%)
              <Tooltip><TooltipTrigger asChild><Info className="w-3 h-3 text-muted-foreground cursor-help" /></TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">Togo : CNSS patronal 16,4% + IPTS 2% = 18,4% par défaut.</TooltipContent></Tooltip>
            </label>
            <div className="flex items-center gap-1">
              <Input type="number" min="0" max="100" step="0.1" className="h-7 text-xs" value={line.employerChargeRate} onChange={e => onUpdate({ ...line, employerChargeRate: parseFloat(e.target.value) || 0 })} />
              <span className="text-xs text-muted-foreground shrink-0">%</span>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Avantages mensuels (XOF)</label>
            <Input type="number" min="0" step="1000" className="h-7 text-xs" placeholder="50 000" value={line.benefitsMonthly || ""} onChange={e => onUpdate({ ...line, benefitsMonthly: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Heures / semaine</label>
            <Input type="number" min="1" max="80" step="0.5" className="h-7 text-xs" value={line.weeklyHours} onChange={e => onUpdate({ ...line, weeklyHours: parseFloat(e.target.value) || 40 })} />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              Heures allouées
              <Tooltip><TooltipTrigger asChild><Info className="w-3 h-3 text-muted-foreground cursor-help" /></TooltipTrigger>
                <TooltipContent className="text-xs">Heures de travail effectif sur ce projet/mission.</TooltipContent></Tooltip>
            </label>
            <Input type="number" min="0" step="1" className="h-7 text-xs" placeholder="80" value={line.allocatedHours || ""} onChange={e => onUpdate({ ...line, allocatedHours: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="sm:col-span-2 lg:col-span-3 bg-purple-50 border border-purple-100 rounded-md px-3 py-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div><div className="text-muted-foreground">Heures/mois</div><div className="font-semibold">{((line.weeklyHours * 52) / 12).toFixed(1)} h</div></div>
              <div><div className="text-muted-foreground">Coût employeur/mois</div><div className="font-semibold">{formatFCFA(Math.round(monthlyCostEmployeur))}</div></div>
              <div><div className="text-muted-foreground">Taux horaire réel</div><div className="font-bold text-purple-700">{formatFCFA(Math.round(hourlyRate))} / h</div></div>
              <div><div className="text-muted-foreground">Coût total alloué</div><div className="font-bold text-slate-800">{formatFCFA(Math.round(totalCost))}</div></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PricingCalculator() {
  const [, navigate] = useLocation();
  const [scenarios, setScenarios] = useState<Scenario[]>([{ ...DEFAULT_SCENARIO, id: uid() }]);
  const [activeId, setActiveId] = useState(scenarios[0].id);
  const [sendDocOpen, setSendDocOpen] = useState<DocType | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  const scenario = useMemo(() => scenarios.find(s => s.id === activeId) ?? scenarios[0], [scenarios, activeId]);
  const result = useMemo(() => calculate(scenario), [scenario]);
  const recommendations = useMemo(() => generateRecommendations(result, scenario), [result, scenario]);

  const updateScenario = useCallback((patch: Partial<Scenario>) => {
    setScenarios(prev => prev.map(s => s.id === activeId ? { ...s, ...patch } : s));
  }, [activeId]);

  const updateCorporateTax = useCallback((patch: Partial<CorporateTaxConfig>) => {
    setScenarios(prev => prev.map(s => s.id === activeId ? { ...s, corporateTax: { ...s.corporateTax, ...patch } } : s));
  }, [activeId]);

  // ── FP&A: YTD profit auto-fetch
  const { data: fpaData } = useQuery<{ profitBeforeTax?: number }>({
    queryKey: ["fpa-summary"],
    queryFn: () => apiFetch("/api/fpa/summary"),
    staleTime: 10 * 60_000,
    retry: false,
  });

  const fpaYtdProfit = fpaData?.profitBeforeTax;

  // ── Catalogue
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogTab, setCatalogTab] = useState<"product" | "service" | "labor">("product");
  const [catalogSearch, setCatalogSearch] = useState("");

  const { data: productsRaw } = useQuery<CatalogProduct[]>({
    queryKey: ["catalog-products"],
    queryFn: () => apiFetch("/api/inventory/products?activeOnly=true"),
    staleTime: 5 * 60_000,
    enabled: catalogOpen && catalogTab !== "labor",
  });
  const { data: servicesRaw } = useQuery<{ data: CatalogService[] }>({
    queryKey: ["catalog-services"],
    queryFn: () => apiFetch("/api/services?active=true"),
    staleTime: 5 * 60_000,
    enabled: catalogOpen && catalogTab !== "labor",
  });
  const { data: collabsRaw } = useQuery<{ data: CatalogCollab[] }>({
    queryKey: ["catalog-collabs"],
    queryFn: () => apiFetch("/api/collaborators?limit=200"),
    staleTime: 5 * 60_000,
    enabled: catalogOpen && catalogTab === "labor",
  });

  const catalogEntries = useMemo((): CatalogEntry[] => {
    if (catalogTab === "labor") return [];
    if (catalogTab === "product") {
      return (productsRaw ?? []).filter(p => p.isActive !== false).map(p => ({
        id: p.id, name: p.name, ref: p.sku, unit: p.unit, price: Number(p.sellingPriceFcfa), taxRate: Number(p.taxRatePct), kind: "product" as const,
      }));
    }
    return (servicesRaw?.data ?? []).filter(s => s.isActive !== false).map(s => ({
      id: s.id, name: s.name, ref: s.code, unit: s.unit, price: Number(s.unitPrice), taxRate: 18, kind: "service" as const,
    }));
  }, [catalogTab, productsRaw, servicesRaw]);

  const filteredEntries = useMemo(() =>
    catalogSearch ? catalogEntries.filter(e => e.name.toLowerCase().includes(catalogSearch.toLowerCase()) || e.ref.toLowerCase().includes(catalogSearch.toLowerCase()))
    : catalogEntries, [catalogEntries, catalogSearch]);

  const filteredCollabs = useMemo(() => {
    const list = collabsRaw?.data ?? [];
    return catalogSearch ? list.filter(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(catalogSearch.toLowerCase()) || (c.position ?? "").toLowerCase().includes(catalogSearch.toLowerCase())) : list;
  }, [collabsRaw, catalogSearch]);

  const applyCatalogItem = useCallback((entry: CatalogEntry) => {
    updateScenario({ productName: entry.name, taxRate: entry.taxRate, costItems: [...scenario.costItems.filter(c => !c.label.startsWith("[Catalogue]")), { id: uid(), label: `[Catalogue] ${entry.name}`, category: entry.kind === "product" ? ("purchase" as const) : ("direct" as const), amount: entry.price }] });
    setCatalogOpen(false); setCatalogSearch("");
    toast.success(`${entry.name} chargé depuis le catalogue`);
  }, [scenario.costItems, updateScenario]);

  const applyCollabToLabor = useCallback(async (collab: CatalogCollab) => {
    const collabName = `${collab.firstName} ${collab.lastName}${collab.position ? ` — ${collab.position}` : ""}`;
    try {
      const cost = await apiFetch(`/api/collaborators/${collab.id}/employer-cost`) as { baseSalary: number; weeklyHours: number; employerChargeRate: number; totalBenefitsMonthly: number; hourlyRate: number; contractType: string | null };
      const newLine: LaborLineItem = { id: uid(), name: collabName, collaboratorId: collab.id, contractType: cost.contractType ?? "CDI", monthlySalaryBrut: cost.baseSalary ?? Number(collab.baseSalary ?? 0), employerChargeRate: cost.employerChargeRate ?? scenario.laborSettings.employerChargeRate, benefitsMonthly: cost.totalBenefitsMonthly ?? 0, weeklyHours: cost.weeklyHours ?? scenario.laborSettings.weeklyHours, allocatedHours: 80 };
      updateScenario({ laborLines: [...(scenario.laborLines ?? []), newLine] });
      const hrRate = Math.round(cost.hourlyRate ?? 0);
      toast.success(hrRate > 0 ? `${collab.firstName} ${collab.lastName} — taux horaire : ${hrRate.toLocaleString("fr-FR")} FCFA/h` : `${collab.firstName} ${collab.lastName} ajouté`);
    } catch {
      const newLine: LaborLineItem = { id: uid(), name: collabName, collaboratorId: collab.id, contractType: "CDI", monthlySalaryBrut: Number(collab.baseSalary ?? 0), employerChargeRate: scenario.laborSettings.employerChargeRate, benefitsMonthly: 0, weeklyHours: scenario.laborSettings.weeklyHours, allocatedHours: 80 };
      updateScenario({ laborLines: [...(scenario.laborLines ?? []), newLine] });
      toast.success(`${collab.firstName} ${collab.lastName} ajouté`);
    }
    setCatalogSearch("");
  }, [scenario.laborLines, scenario.laborSettings, updateScenario]);

  const addCostItem    = () => updateScenario({ costItems: [...scenario.costItems, { id: uid(), label: "", category: "direct", amount: 0 }] });
  const updateCostItem = (id: string, item: CostItem) => updateScenario({ costItems: scenario.costItems.map(c => c.id === id ? item : c) });
  const removeCostItem = (id: string) => updateScenario({ costItems: scenario.costItems.filter(c => c.id !== id) });

  const addLaborLine = () => {
    const newLine: LaborLineItem = { id: uid(), name: "", contractType: "CDI", monthlySalaryBrut: 0, employerChargeRate: scenario.laborSettings.employerChargeRate, benefitsMonthly: 0, weeklyHours: scenario.laborSettings.weeklyHours, allocatedHours: 0 };
    updateScenario({ laborLines: [...(scenario.laborLines ?? []), newLine] });
  };
  const updateLaborLine = (id: string, line: LaborLineItem) => updateScenario({ laborLines: (scenario.laborLines ?? []).map(l => l.id === id ? line : l) });
  const removeLaborLine = (id: string) => updateScenario({ laborLines: (scenario.laborLines ?? []).filter(l => l.id !== id) });

  const totalLaborCost = useMemo(() => (scenario.laborLines ?? []).reduce((acc, l) => acc + computeLaborLineCost(l).totalCost, 0), [scenario.laborLines]);

  const addScenario = () => {
    const newS: Scenario = { ...scenario, id: uid(), name: `Scénario ${scenarios.length + 1}`, costItems: scenario.costItems.map(c => ({ ...c, id: uid() })) };
    setScenarios(prev => [...prev, newS]);
    setActiveId(newS.id);
  };
  const removeScenario = (id: string) => {
    if (scenarios.length <= 1) { toast.error("Au moins un scénario requis"); return; }
    const remaining = scenarios.filter(s => s.id !== id);
    setScenarios(remaining);
    setActiveId(remaining[0].id);
  };
  const saveScenario = (updated: Scenario) => { setScenarios(prev => prev.map(s => s.id === activeId ? updated : s)); toast.success("Scénario enregistré"); };
  const resetScenario = () => { if (!confirm("Réinitialiser ce scénario ?")) return; setScenarios(prev => prev.map(s => s.id === activeId ? { ...DEFAULT_SCENARIO, id: s.id, name: s.name } : s)); };

  // Auto-scenarios (4 fixed)
  const autoScenarios = useMemo(() => AUTO_SCENARIOS.map(as => {
    const s = { ...scenario, marginMode: "net" as MarginMode, marginTarget: as.margin };
    const r = calculate(s);
    return { ...as, priceHT: r.priceHT, priceTTC: r.priceTTC, grossMarginPct: r.grossMarginPct, netMarginPct: r.netMarginPct, netProfit: r.netProfit, corporateTax: r.corporateTax };
  }), [scenario]);

  // Pie chart data
  const pieData = useMemo(() => {
    const total = result.priceTTC;
    const entries: { name: string; value: number; pct: number }[] = [];
    for (const [k, v] of Object.entries(result.byCategory)) {
      if (v > 0) entries.push({ name: CATEGORIES[k as CostCategory].label, value: Math.round(v), pct: (v / total) * 100 });
    }
    if (result.grossMargin > 0) entries.push({ name: "Marge brute", value: Math.round(result.grossMargin), pct: (result.grossMargin / total) * 100 });
    if (result.taxAmount > 0) entries.push({ name: `TVA (${scenario.taxRate}%)`, value: Math.round(result.taxAmount), pct: (result.taxAmount / total) * 100 });
    return entries;
  }, [result, scenario.taxRate]);

  const compareData = useMemo(() => scenarios.map(s => {
    const r = calculate(s);
    return { name: s.name, coût: Math.round(r.totalCost), prixHT: Math.round(r.priceHT), prixTTC: Math.round(r.priceTTC), margeNette: Math.round(r.netMarginPct) };
  }), [scenarios]);

  const warnings = useMemo(() => {
    const w: string[] = [];
    if (result.netMarginPct < 5 && result.totalCost > 0) w.push("Marge nette inférieure à 5% — risque élevé");
    if (result.netMarginPct > 80) w.push("Marge supérieure à 80% — vérifier la cohérence");
    if (result.totalCost === 0) w.push("Aucun coût saisi");
    if (!scenario.productName) w.push("Produit / service non nommé");
    return w;
  }, [result, scenario.productName]);

  return (
    <TooltipProvider>
      <div className="space-y-5 animate-in fade-in duration-500">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
              <Tag className="w-7 h-7 text-[#C8A24B]" />
              Calculateur tarifaire stratégique
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Coûts complets · Marge brute & nette · Impôt société · Scénarios & recommandations</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={resetScenario} className="gap-1.5"><RotateCcw className="w-3.5 h-3.5" /> Réinitialiser</Button>
            <Button variant="outline" size="sm" onClick={() => setSaveDialogOpen(true)} className="gap-1.5"><Save className="w-3.5 h-3.5" /> Enregistrer</Button>
            <Button variant="outline" size="sm" onClick={addScenario} className="gap-1.5"><Copy className="w-3.5 h-3.5" /> Dupliquer</Button>
          </div>
        </div>

        {/* ── Warnings ── */}
        {warnings.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-1.5 rounded-full">
                <AlertCircle className="w-3 h-3 shrink-0" /> {w}
              </div>
            ))}
          </div>
        )}

        {/* ── Scenario tabs ── */}
        <div className="flex items-center gap-2 flex-wrap">
          {scenarios.map(s => (
            <button key={s.id} onClick={() => setActiveId(s.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${s.id === activeId ? "bg-[#C8A24B] text-white border-[#C8A24B] shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:border-[#C8A24B]/50"}`}>
              {s.name}
              {scenarios.length > 1 && s.id === activeId && (
                <span className="ml-2 opacity-60 hover:opacity-100 cursor-pointer" onClick={(e) => { e.stopPropagation(); removeScenario(s.id); }}>×</span>
              )}
            </button>
          ))}
          <Button size="sm" variant="ghost" className="h-8 text-xs gap-1 text-[#C8A24B] hover:bg-amber-50" onClick={addScenario}><Plus className="w-3 h-3" /> Nouveau scénario</Button>
        </div>

        {/* ── Main layout ── */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_440px] gap-6">

          {/* ══ LEFT: Inputs ══ */}
          <div className="space-y-4">

            {/* Produit / Service */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2"><Package className="w-4 h-4 text-[#C8A24B]" /> Produit / Service tarifé</CardTitle>
                  <Button size="sm" variant="outline" className={`h-7 text-xs gap-1.5 ${catalogOpen ? "bg-[#C8A24B] text-white border-[#C8A24B]" : "text-[#C8A24B] border-[#C8A24B]/40 hover:bg-amber-50"}`} onClick={() => { setCatalogOpen(o => !o); setCatalogSearch(""); }}>
                    <BookOpen className="w-3.5 h-3.5" />
                    {catalogOpen ? "Fermer le catalogue" : "Charger depuis le catalogue"}
                  </Button>
                </div>
              </CardHeader>

              {catalogOpen && (
                <div className="border-b bg-slate-50/70 px-4 py-3 space-y-3">
                  <div className="flex items-center gap-1 flex-wrap">
                    {([{ key: "product", label: "Produits" }, { key: "service", label: "Services" }, { key: "labor", label: "Personnel" }] as const).map(({ key, label }) => (
                      <button key={key} onClick={() => { setCatalogTab(key); setCatalogSearch(""); }}
                        className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${catalogTab === key ? (key === "labor" ? "bg-purple-700 text-white border-purple-700" : "bg-[#1a1a2e] text-white border-[#1a1a2e]") : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}>
                        {label}
                      </button>
                    ))}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {catalogTab === "labor" ? `${filteredCollabs.length} personne(s)` : `${filteredEntries.length} article(s)`}
                    </span>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input className="pl-8 h-8 text-xs" placeholder="Rechercher…" value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)} />
                    {catalogSearch && <button onClick={() => setCatalogSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="w-3.5 h-3.5" /></button>}
                  </div>

                  {catalogTab !== "labor" && (
                    <div className="max-h-52 overflow-y-auto rounded-md border border-slate-200 bg-white divide-y divide-slate-100">
                      {filteredEntries.length === 0 && <div className="py-6 text-center text-xs text-muted-foreground">{catalogSearch ? "Aucun résultat" : "Catalogue vide"}</div>}
                      {filteredEntries.map(entry => (
                        <button key={entry.id} onClick={() => applyCatalogItem(entry)} className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-amber-50 transition-colors group">
                          <div className="min-w-0 flex-1"><div className="text-xs font-semibold text-slate-800 truncate">{entry.name}</div><div className="text-[10px] text-muted-foreground font-mono">{entry.ref} · {entry.unit}</div></div>
                          <div className="ml-3 flex items-center gap-2 shrink-0">
                            <div className="text-right"><div className="text-xs font-bold text-[#C8A24B]">{formatFCFA(entry.price)}</div>{entry.taxRate > 0 && <div className="text-[10px] text-muted-foreground">TVA {entry.taxRate}%</div>}</div>
                            <div className="w-5 h-5 rounded-full bg-[#C8A24B]/10 group-hover:bg-[#C8A24B] flex items-center justify-center transition-colors"><Plus className="w-3 h-3 text-[#C8A24B] group-hover:text-white" /></div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {catalogTab === "labor" && (
                    <div className="max-h-52 overflow-y-auto rounded-md border border-purple-100 bg-white divide-y divide-slate-100">
                      {filteredCollabs.length === 0 && <div className="py-6 text-center text-xs text-muted-foreground">Aucun collaborateur</div>}
                      {filteredCollabs.map(c => {
                        const baseSalary = Number(c.baseSalary ?? 0);
                        const monthlyHours = (scenario.laborSettings.weeklyHours * 52) / 12;
                        const employerCost = baseSalary * (1 + scenario.laborSettings.employerChargeRate / 100);
                        const hourlyRate = monthlyHours > 0 && baseSalary > 0 ? employerCost / monthlyHours : null;
                        return (
                          <button key={c.id} onClick={() => applyCollabToLabor(c)} className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-purple-50 group">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center shrink-0 text-purple-700 text-[10px] font-bold">{c.firstName[0]}{c.lastName[0]}</div>
                              <div className="min-w-0"><div className="text-xs font-semibold text-slate-800 truncate">{c.firstName} {c.lastName}</div><div className="text-[10px] text-muted-foreground truncate">{c.position ?? "—"}{c.department ? ` · ${c.department}` : ""}</div></div>
                            </div>
                            <div className="ml-3 flex items-center gap-2 shrink-0">
                              {hourlyRate !== null ? <div className="text-xs font-bold text-purple-700">{formatFCFA(Math.round(hourlyRate))}/h</div> : <div className="text-[10px] text-muted-foreground">non renseigné</div>}
                              <div className="w-5 h-5 rounded-full bg-purple-100 group-hover:bg-purple-600 flex items-center justify-center transition-colors"><Plus className="w-3 h-3 text-purple-600 group-hover:text-white" /></div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground">{catalogTab === "labor" ? "Cliquer ajoute la personne dans la section Main-d'œuvre." : "Cliquer charge le nom, TVA et prix comme poste de coût."}</p>
                </div>
              )}

              <CardContent className="pt-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Désignation *</Label><Input placeholder="Ex. Étude technique, Formation, Lot électricité…" value={scenario.productName} onChange={(e) => updateScenario({ productName: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Quantité</Label><Input type="number" min="1" step="1" placeholder="1" value={scenario.quantity} onChange={(e) => updateScenario({ quantity: parseInt(e.target.value) || 1 })} /></div>
                  <div className="sm:col-span-2 space-y-1"><Label>Description / Périmètre</Label><Textarea rows={2} placeholder="Contexte, hypothèses retenues…" value={scenario.description} onChange={(e) => updateScenario({ description: e.target.value })} /></div>
                </div>
              </CardContent>
            </Card>

            {/* Structure des coûts */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2"><DollarSign className="w-4 h-4 text-[#C8A24B]" /> Structure des coûts</CardTitle>
                  <div className="text-xs text-muted-foreground">{scenario.costItems.length} poste(s) · {formatFCFA(result.totalCost)}</div>
                </div>
              </CardHeader>
              <CardContent className="pt-3">
                <div className="grid grid-cols-[1fr_140px_120px_80px_40px] gap-2 text-xs text-muted-foreground font-medium mb-1 pb-1 border-b border-slate-100">
                  <span>Libellé</span><span>Catégorie</span><span className="text-right">Montant</span><span className="text-center">Type</span><span />
                </div>
                {scenario.costItems.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground text-sm"><DollarSign className="w-8 h-8 mx-auto text-slate-200 mb-2" />Aucun poste de coût</div>
                )}
                {scenario.costItems.map(item => (
                  <CostItemRow key={item.id} item={item} onUpdate={(updated) => updateCostItem(item.id, updated)} onRemove={() => removeCostItem(item.id)} />
                ))}
                <Button variant="outline" size="sm" className="mt-3 w-full gap-1.5 text-xs border-dashed text-[#C8A24B] border-[#C8A24B]/40 hover:bg-amber-50" onClick={addCostItem}>
                  <Plus className="w-3.5 h-3.5" /> Ajouter un poste de coût
                </Button>
              </CardContent>
            </Card>

            {/* Personnel / Main-d'œuvre */}
            <Card className="shadow-sm border-purple-100">
              <CardHeader className="pb-3 border-b border-purple-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <HardHat className="w-4 h-4 text-purple-600" />
                    Personnel / Main-d'œuvre
                    {(scenario.laborLines ?? []).length > 0 && (
                      <span className="text-xs font-normal text-purple-600 bg-purple-50 border border-purple-100 rounded-full px-2 py-0.5">
                        {(scenario.laborLines ?? []).length} ligne(s) · {formatFCFA(Math.round(totalLaborCost))}
                      </span>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 text-purple-600 border-purple-200 hover:bg-purple-50" onClick={() => { setCatalogOpen(true); setCatalogTab("labor"); setCatalogSearch(""); }}><BookOpen className="w-3.5 h-3.5" /> Collaborateurs</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 text-purple-600 border-purple-200 hover:bg-purple-50" onClick={addLaborLine}><Plus className="w-3.5 h-3.5" /> Ajouter</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-3">
                {(scenario.laborLines ?? []).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm"><HardHat className="w-8 h-8 mx-auto text-slate-200 mb-2" /><p>Aucune ressource — cliquez « Ajouter » ou chargez depuis les collaborateurs</p><p className="text-xs mt-1 text-muted-foreground/60">Salaire brut + charges patronales + avantages → coût employeur réel</p></div>
                ) : (
                  <div className="space-y-2">
                    {(scenario.laborLines ?? []).map(line => (
                      <LaborLineRow key={line.id} line={line} onUpdate={(updated) => updateLaborLine(line.id, updated)} onRemove={() => removeLaborLine(line.id)} />
                    ))}
                    <div className="flex items-center justify-between pt-2 border-t border-purple-100 text-sm">
                      <span className="text-muted-foreground flex items-center gap-1.5"><Calculator className="w-3.5 h-3.5 text-purple-500" />Total Main-d'œuvre</span>
                      <span className="font-bold text-purple-700">{formatFCFA(Math.round(totalLaborCost))}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Paramétrage marge & TVA */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[#C8A24B]" /> Marge cible & TVA</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">Mode de calcul du prix<Tooltip><TooltipTrigger asChild><Info className="w-3 h-3 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent className="max-w-xs text-xs"><strong>Marge nette</strong> : % du prix HT restant après coûts.<br /><strong>Coefficient</strong> : multiplicateur sur le coût.</TooltipContent></Tooltip></Label>
                    <Select value={scenario.marginMode} onValueChange={(v) => updateScenario({ marginMode: v as MarginMode })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(MARGIN_MODES).map(([k, v]) => <SelectItem key={k} value={k}><div><div className="font-medium text-sm">{v.label}</div><div className="text-xs text-muted-foreground">{v.desc}</div></div></SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{scenario.marginMode === "markup" ? "Coefficient (%)" : scenario.marginMode === "net" ? "Marge nette cible (%)" : "Marge brute cible (%)"}</Label>
                    <div className="flex items-center gap-2">
                      <Input type="number" min="0" step="0.5" value={scenario.marginTarget} onChange={(e) => updateScenario({ marginTarget: parseFloat(e.target.value) || 0 })} className="flex-1" />
                      <span className="text-sm font-semibold text-muted-foreground">%</span>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {(scenario.marginMode === "markup" ? [20, 30, 40, 50] : [10, 20, 25, 33]).map(v => (
                        <Button key={v} size="sm" variant="outline" className={`h-6 text-xs px-2 ${scenario.marginTarget === v ? "bg-[#C8A24B] text-white border-[#C8A24B]" : ""}`} onClick={() => updateScenario({ marginTarget: v })}>{v}%</Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Taux de TVA (%)</Label>
                    <div className="flex items-center gap-2">
                      <Input type="number" min="0" max="50" step="0.5" value={scenario.taxRate} onChange={(e) => updateScenario({ taxRate: parseFloat(e.target.value) || 0 })} className="flex-1" />
                      <span className="text-sm font-semibold text-muted-foreground">%</span>
                    </div>
                    <div className="flex gap-1">
                      {[0, 10, 18, 20].map(v => <Button key={v} size="sm" variant="outline" className={`h-6 text-xs px-2 ${scenario.taxRate === v ? "bg-[#C8A24B] text-white border-[#C8A24B]" : ""}`} onClick={() => updateScenario({ taxRate: v })}>{v === 0 ? "Exonéré" : `${v}%`}</Button>)}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">Application de la TVA<Tooltip><TooltipTrigger asChild><Info className="w-3 h-3 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent>En sus = TVA ajoutée au prix HT. Incluse = TVA déjà dans le prix.</TooltipContent></Tooltip></Label>
                    <div className="flex gap-2">
                      <Button size="sm" variant={scenario.taxMode === "on_top" ? "default" : "outline"} className={`flex-1 text-xs ${scenario.taxMode === "on_top" ? "bg-[#C8A24B] text-white border-[#C8A24B]" : ""}`} onClick={() => updateScenario({ taxMode: "on_top" })}>TVA en sus</Button>
                      <Button size="sm" variant={scenario.taxMode === "included" ? "default" : "outline"} className={`flex-1 text-xs ${scenario.taxMode === "included" ? "bg-[#C8A24B] text-white border-[#C8A24B]" : ""}`} onClick={() => updateScenario({ taxMode: "included" })}>TVA incluse</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Impôt société (IS) ── */}
            <Card className={`shadow-sm ${scenario.corporateTax.enabled ? "border-orange-200" : ""}`}>
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-orange-500" />
                    Impôt sur les sociétés (IS)
                    <Tooltip>
                      <TooltipTrigger asChild><Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" /></TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        Calcule l'impôt IS incrémental généré par ce deal, en tenant compte du bénéfice YTD déjà réalisé et du barème progressif applicable.
                      </TooltipContent>
                    </Tooltip>
                  </CardTitle>
                  <button
                    type="button"
                    onClick={() => updateCorporateTax({ enabled: !scenario.corporateTax.enabled })}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${scenario.corporateTax.enabled ? "bg-orange-500" : "bg-slate-200"}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${scenario.corporateTax.enabled ? "translate-x-4.5" : "translate-x-0.5"}`} />
                  </button>
                </div>
              </CardHeader>

              {scenario.corporateTax.enabled && (
                <CardContent className="pt-4 space-y-4">
                  {/* YTD Profit */}
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                      Bénéfice YTD avant IS (FCFA)
                      <Tooltip><TooltipTrigger asChild><Info className="w-3 h-3 text-muted-foreground cursor-help" /></TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs">Bénéfice cumulé de l'exercice en cours avant IS. Ce deal s'additionne à ce montant pour recalculer l'IS global.</TooltipContent>
                      </Tooltip>
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="number" min="0" step="100000"
                        placeholder="0"
                        value={scenario.corporateTax.ytdProfitBeforeTax || ""}
                        onChange={e => updateCorporateTax({ ytdProfitBeforeTax: parseFloat(e.target.value) || 0 })}
                        className="flex-1"
                      />
                      {fpaYtdProfit !== undefined && fpaYtdProfit !== null && (
                        <Button size="sm" variant="outline" className="text-xs gap-1.5 border-orange-200 text-orange-700 hover:bg-orange-50 whitespace-nowrap"
                          onClick={() => updateCorporateTax({ ytdProfitBeforeTax: fpaYtdProfit })}>
                          <Zap className="w-3 h-3" />
                          Depuis FP&A ({formatFCFA(Math.round(fpaYtdProfit))})
                        </Button>
                      )}
                    </div>
                    {scenario.corporateTax.ytdProfitBeforeTax > 0 && (
                      <p className="text-xs text-muted-foreground">Bénéfice projeté après ce deal : {formatFCFA(Math.round(scenario.corporateTax.ytdProfitBeforeTax + result.profitBeforeTax))}</p>
                    )}
                  </div>

                  {/* Barème IS */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Barème IS (Togo BIC — configurable)</Label>
                    </div>
                    <div className="space-y-1.5">
                      {scenario.corporateTax.brackets.map((bracket, i) => (
                        <div key={bracket.id} className="grid grid-cols-[1fr_1fr_80px_32px] gap-2 items-center">
                          <div className="space-y-0.5">
                            <div className="text-[10px] text-muted-foreground font-medium">Minimum (XOF)</div>
                            <Input type="number" min="0" step="100000" className="h-7 text-xs" value={bracket.min} onChange={e => {
                              const updated = [...scenario.corporateTax.brackets];
                              updated[i] = { ...bracket, min: parseFloat(e.target.value) || 0 };
                              updateCorporateTax({ brackets: updated });
                            }} />
                          </div>
                          <div className="space-y-0.5">
                            <div className="text-[10px] text-muted-foreground font-medium">Maximum (XOF, vide = illimité)</div>
                            <Input type="number" min="0" step="100000" className="h-7 text-xs" placeholder="illimité" value={bracket.max ?? ""} onChange={e => {
                              const updated = [...scenario.corporateTax.brackets];
                              updated[i] = { ...bracket, max: e.target.value === "" ? null : parseFloat(e.target.value) || 0 };
                              updateCorporateTax({ brackets: updated });
                            }} />
                          </div>
                          <div className="space-y-0.5">
                            <div className="text-[10px] text-muted-foreground font-medium">Taux (%)</div>
                            <div className="flex items-center gap-1">
                              <Input type="number" min="0" max="100" step="0.5" className="h-7 text-xs" value={bracket.rate} onChange={e => {
                                const updated = [...scenario.corporateTax.brackets];
                                updated[i] = { ...bracket, rate: parseFloat(e.target.value) || 0 };
                                updateCorporateTax({ brackets: updated });
                              }} />
                              <span className="text-xs text-muted-foreground">%</span>
                            </div>
                          </div>
                          <Button size="icon" variant="ghost" className="h-7 w-7 mt-4 text-red-400 hover:text-red-600" onClick={() => updateCorporateTax({ brackets: scenario.corporateTax.brackets.filter(b => b.id !== bracket.id) })} disabled={scenario.corporateTax.brackets.length <= 1}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="outline" className="text-xs gap-1.5 border-dashed border-orange-300 text-orange-700 hover:bg-orange-50" onClick={() => updateCorporateTax({ brackets: [...scenario.corporateTax.brackets, { id: uid(), label: "Nouvelle tranche", min: 0, max: null, rate: 29 }] })}>
                        <Plus className="w-3 h-3" /> Ajouter une tranche
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs gap-1.5 text-slate-500 hover:bg-slate-50" onClick={() => updateCorporateTax({ brackets: DEFAULT_TAX_BRACKETS })}>
                        <RotateCcw className="w-3 h-3" /> Réinitialiser (Togo BIC)
                      </Button>
                    </div>
                  </div>

                  {/* Résultat IS */}
                  {result.corporateTax > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <div className="grid grid-cols-3 gap-3 text-center text-xs">
                        <div>
                          <div className="text-muted-foreground">IS incrémental</div>
                          <div className="font-bold text-orange-700 text-sm">{formatFCFA(Math.round(result.corporateTax))}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Taux effectif</div>
                          <div className="font-bold text-orange-700 text-sm">{result.effectiveTaxRate.toFixed(1)}%</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Taux marginal</div>
                          <div className="font-bold text-orange-700 text-sm">{result.marginalTaxRate.toFixed(1)}%</div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          </div>

          {/* ══ RIGHT: Results ══ */}
          <div className="space-y-4">

            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white rounded-xl p-4 shadow">
                <div className="text-xs text-slate-400 font-medium mb-1">Coût de revient</div>
                <div className="text-xl font-bold">{formatFCFA(result.totalCost)}</div>
                {scenario.quantity > 1 && <div className="text-xs text-slate-400 mt-0.5">Unit. : {formatFCFA(result.unitCost)}</div>}
              </div>
              <div className="bg-gradient-to-br from-[#C8A24B] to-[#a8862f] text-white rounded-xl p-4 shadow">
                <div className="text-xs text-amber-100 font-medium mb-1">Prix de vente HT</div>
                <div className="text-xl font-bold">{formatFCFA(result.priceHT)}</div>
                {scenario.quantity > 1 && <div className="text-xs text-amber-100 mt-0.5">Unit. : {formatFCFA(result.unitHT)}</div>}
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

            {/* Compte de résultat synthétique */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2 border-b">
                <CardTitle className="text-sm font-semibold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[#C8A24B]" />Compte de résultat synthétique</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs">
                  <tbody>
                    <tr className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 text-slate-600 font-medium">Chiffre d'affaires HT</td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-800">{formatFCFA(result.priceHT)}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">100%</td>
                    </tr>
                    <tr className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-2 text-slate-500 pl-6">— Coûts directs</td>
                      <td className="px-4 py-2 text-right text-red-600">{formatFCFA(result.byCategory.direct + result.byCategory.purchase)}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">{result.priceHT > 0 ? (((result.byCategory.direct + result.byCategory.purchase) / result.priceHT) * 100).toFixed(1) + "%" : "—"}</td>
                    </tr>
                    <tr className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-2 text-slate-500 pl-6">— Main-d'œuvre</td>
                      <td className="px-4 py-2 text-right text-red-600">{formatFCFA(result.byCategory.labor)}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">{result.priceHT > 0 ? ((result.byCategory.labor / result.priceHT) * 100).toFixed(1) + "%" : "—"}</td>
                    </tr>
                    <tr className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-2 text-slate-500 pl-6">— Logistique & autres</td>
                      <td className="px-4 py-2 text-right text-red-600">{formatFCFA(result.byCategory.logistics + result.byCategory.indirect + result.byCategory.tax_input + result.byCategory.other)}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">{result.priceHT > 0 ? (((result.byCategory.logistics + result.byCategory.indirect + result.byCategory.tax_input + result.byCategory.other) / result.priceHT) * 100).toFixed(1) + "%" : "—"}</td>
                    </tr>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <td className="px-4 py-2.5 font-bold text-slate-700">Marge brute</td>
                      <td className={`px-4 py-2.5 text-right font-bold ${result.grossMargin < 0 ? "text-red-600" : "text-emerald-700"}`}>{formatFCFA(result.grossMargin)}</td>
                      <td className={`px-4 py-2.5 text-right font-semibold ${result.grossMarginPct < 10 ? "text-red-500" : "text-emerald-600"}`}>{result.grossMarginPct.toFixed(1)}%</td>
                    </tr>
                    {scenario.corporateTax.enabled && (
                      <>
                        <tr className="border-b border-slate-100 hover:bg-orange-50/30">
                          <td className="px-4 py-2 text-slate-600 font-medium">Résultat avant IS</td>
                          <td className="px-4 py-2 text-right font-semibold">{formatFCFA(result.profitBeforeTax)}</td>
                          <td className="px-4 py-2 text-right text-muted-foreground">{result.priceHT > 0 ? (result.operatingMarginPct.toFixed(1) + "%") : "—"}</td>
                        </tr>
                        <tr className="border-b border-slate-100 hover:bg-orange-50/30">
                          <td className="px-4 py-2 text-orange-700 pl-6">— IS incrémental ({result.effectiveTaxRate.toFixed(1)}% effectif)</td>
                          <td className="px-4 py-2 text-right text-orange-700 font-semibold">{formatFCFA(Math.round(result.corporateTax))}</td>
                          <td className="px-4 py-2 text-right text-orange-500">{result.priceHT > 0 ? ((result.corporateTax / result.priceHT) * 100).toFixed(1) + "%" : "—"}</td>
                        </tr>
                      </>
                    )}
                    <tr className="bg-[#C8A24B]/10">
                      <td className="px-4 py-3 font-bold text-[#8a6b2a]">
                        {scenario.corporateTax.enabled ? "Bénéfice net après IS" : "Marge nette"}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold text-sm ${result.netProfit < 0 ? "text-red-600" : "text-[#C8A24B]"}`}>{formatFCFA(result.netProfit)}</td>
                      <td className={`px-4 py-3 text-right font-bold ${result.netMarginPct < 0 ? "text-red-600" : "text-[#C8A24B]"}`}>{result.netMarginPct.toFixed(1)}%</td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Indicateurs de marge */}
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Marge brute</div>
                    <div className={`text-2xl font-bold ${result.grossMarginPct < 10 ? "text-red-500" : result.grossMarginPct < 20 ? "text-amber-500" : "text-emerald-600"}`}>{result.grossMarginPct.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Marge nette</div>
                    <div className={`text-2xl font-bold ${result.netMarginPct < 0 ? "text-red-500" : result.netMarginPct < 10 ? "text-amber-500" : "text-emerald-600"}`}>{result.netMarginPct.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Coefficient</div>
                    <div className="text-2xl font-bold text-slate-700">{result.totalCost > 0 ? (result.priceHT / result.totalCost).toFixed(2) : "—"}</div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Santé de la marge nette</span>
                    <span className={result.netMarginPct < 0 ? "text-red-500 font-semibold" : result.netMarginPct < 10 ? "text-amber-500 font-semibold" : "text-emerald-600 font-semibold"}>
                      {result.netMarginPct < 0 ? "⚠ Déficitaire" : result.netMarginPct < 5 ? "⚠ Critique" : result.netMarginPct < 15 ? "⚠ Faible" : result.netMarginPct < 30 ? "✓ Acceptable" : "✓✓ Bonne"}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${result.netMarginPct < 0 ? "bg-red-500" : result.netMarginPct < 10 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${Math.min(100, Math.max(0, result.netMarginPct * 2))}%` }} />
                  </div>
                </div>
                {result.minimumPriceHT > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 rounded-lg p-2">
                      <div className="text-muted-foreground mb-0.5">Prix minimum (seuil de rentabilité)</div>
                      <div className="font-bold text-slate-800">{formatFCFA(Math.round(result.minimumPriceHT))} HT</div>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-2">
                      <div className="text-muted-foreground mb-0.5">Prix recommandé ({scenario.marginTarget}% net)</div>
                      <div className="font-bold text-emerald-700">{formatFCFA(Math.round(result.recommendedPriceHT))} HT</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── 4 Scénarios automatiques ── */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2 border-b">
                <CardTitle className="text-sm font-semibold flex items-center gap-2"><Target className="w-4 h-4 text-[#C8A24B]" />Grille de prix automatique</CardTitle>
              </CardHeader>
              <CardContent className="pt-3 p-0">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60">
                      <th className="px-4 py-2 text-left text-muted-foreground font-semibold">Scénario</th>
                      <th className="px-3 py-2 text-right text-muted-foreground font-semibold">Prix HT</th>
                      <th className="px-3 py-2 text-right text-muted-foreground font-semibold">Marge brute</th>
                      <th className="px-3 py-2 text-right text-muted-foreground font-semibold">Marge nette</th>
                      {scenario.corporateTax.enabled && <th className="px-3 py-2 text-right text-muted-foreground font-semibold">IS</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {autoScenarios.map(as => (
                      <tr key={as.key} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: as.color }} />
                            <span className="font-semibold text-slate-700">{as.label}</span>
                            <span className="text-muted-foreground">({as.margin}%)</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold">{as.priceHT > 0 ? formatFCFA(Math.round(as.priceHT)) : "—"}</td>
                        <td className={`px-3 py-2.5 text-right font-semibold ${as.grossMarginPct < 10 ? "text-red-500" : "text-emerald-600"}`}>{as.grossMarginPct.toFixed(1)}%</td>
                        <td className={`px-3 py-2.5 text-right font-bold ${as.netMarginPct < 0 ? "text-red-500" : as.netMarginPct < 10 ? "text-amber-500" : "text-emerald-600"}`}>{as.netMarginPct.toFixed(1)}%</td>
                        {scenario.corporateTax.enabled && <td className="px-3 py-2.5 text-right text-orange-600">{as.corporateTax > 0 ? formatFCFA(Math.round(as.corporateTax)) : "—"}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* ── Recommandations automatiques ── */}
            {recommendations.length > 0 && (
              <Card className="shadow-sm">
                <CardHeader className="pb-2 border-b">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2"><Brain className="w-4 h-4 text-purple-600" />Recommandations automatiques</CardTitle>
                </CardHeader>
                <CardContent className="pt-3 space-y-2.5">
                  {recommendations.map((rec, i) => {
                    const styles: Record<RecType, { bg: string; border: string; icon: React.ReactNode }> = {
                      danger:  { bg: "bg-red-50",     border: "border-red-200",     icon: <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" /> },
                      warning: { bg: "bg-amber-50",   border: "border-amber-200",   icon: <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" /> },
                      success: { bg: "bg-emerald-50", border: "border-emerald-200", icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" /> },
                      info:    { bg: "bg-blue-50",    border: "border-blue-200",    icon: <Lightbulb className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" /> },
                    };
                    const s = styles[rec.type];
                    return (
                      <div key={i} className={`rounded-lg border p-3 flex gap-2.5 ${s.bg} ${s.border}`}>
                        {s.icon}
                        <div>
                          <div className="text-xs font-bold text-slate-700 mb-0.5">{rec.title}</div>
                          <div className="text-xs text-slate-600 leading-relaxed">{rec.msg}</div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Graphique structure du prix */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2 border-b"><CardTitle className="text-sm font-semibold">Structure du prix TTC</CardTitle></CardHeader>
              <CardContent className="pt-2 pb-3">
                {result.priceTTC > 0 ? (
                  <ResponsiveContainer width="100%" height={210}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2} dataKey="value">
                        {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <RechartTooltip content={<PieTooltip />} />
                      <Legend formatter={(value) => <span className="text-xs text-slate-600">{value}</span>} wrapperStyle={{ fontSize: "11px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[210px] flex items-center justify-center text-muted-foreground text-sm">Saisir des coûts pour voir la structure tarifaire</div>
                )}
              </CardContent>
            </Card>

            {/* Boutons d'action */}
            <Card className="shadow-sm border-[#C8A24B]/30 bg-amber-50/30">
              <CardHeader className="pb-3 border-b border-[#C8A24B]/20">
                <CardTitle className="text-sm font-semibold text-[#8a6b2a]">Utiliser ce tarif dans un document commercial</CardTitle>
              </CardHeader>
              <CardContent className="pt-3 space-y-2">
                <div className="text-xs text-muted-foreground mb-2">
                  Prix calculé : <strong className="text-[#C8A24B]">{formatFCFA(result.priceTTC)} TTC</strong> · Marge nette : <strong className={result.netMarginPct < 0 ? "text-red-500" : "text-emerald-600"}>{result.netMarginPct.toFixed(1)}%</strong>
                </div>
                <Button className="w-full gap-2 bg-[#C8A24B] hover:bg-[#b8922b] text-white" disabled={result.priceTTC <= 0} onClick={() => setSendDocOpen("proforma")}>
                  <FileSignature className="w-4 h-4" /> Créer un devis (proforma)<ArrowRight className="w-3 h-3 ml-auto" />
                </Button>
                <Button variant="outline" className="w-full gap-2 border-[#C8A24B]/50 text-[#8a6b2a] hover:bg-amber-50" disabled={result.priceTTC <= 0} onClick={() => setSendDocOpen("order")}>
                  <ShoppingCart className="w-4 h-4" /> Créer une commande<ArrowRight className="w-3 h-3 ml-auto" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Comparaison de scénarios manuels */}
        {scenarios.length > 1 && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[#C8A24B]" /> Comparaison des scénarios</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
                {scenarios.map(s => {
                  const r = calculate(s);
                  return (
                    <div key={s.id} className={`rounded-lg border p-3 cursor-pointer transition-all ${s.id === activeId ? "border-[#C8A24B] bg-amber-50/30" : "border-slate-200 hover:border-[#C8A24B]/40"}`} onClick={() => setActiveId(s.id)}>
                      <div className="text-sm font-bold truncate">{s.name}</div>
                      <div className="text-lg font-bold text-[#C8A24B] mt-1">{formatFCFA(r.priceTTC)}</div>
                      <div className="text-xs text-muted-foreground">Marge nette : <span className={`font-semibold ${r.netMarginPct < 0 ? "text-red-500" : "text-emerald-600"}`}>{r.netMarginPct.toFixed(1)}%</span></div>
                    </div>
                  );
                })}
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={compareData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 10 }} />
                  <RechartTooltip formatter={(v: number) => formatFCFA(v)} />
                  <Bar dataKey="coût" name="Coût revient" fill="#6B7280" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="prixHT" name="Prix HT" fill="#C8A24B" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="prixTTC" name="Prix TTC" fill="#10B981" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {sendDocOpen && <SendToDocDialog open={true} onClose={() => setSendDocOpen(null)} result={result} scenario={scenario} docType={sendDocOpen} />}
      {saveDialogOpen && <ScenarioSaveDialog scenario={scenario} onSave={saveScenario} onClose={() => setSaveDialogOpen(false)} />}
    </TooltipProvider>
  );
}
