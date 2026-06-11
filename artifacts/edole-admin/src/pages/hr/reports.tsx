import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { HrShell } from "./_layout";
import { apiFetch } from "@/lib/api";
import { formatFCFA } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  CheckCircle2, AlertTriangle, Clock, CalendarOff, Banknote,
  Users, FileSignature, ArrowRightLeft, Download, RefreshCw,
  FileBarChart2, ChevronDown, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type ReportType =
  | "attendance" | "lateness" | "worked-hours" | "leaves"
  | "headcount" | "payroll" | "contracts" | "movements";

interface ReportDef {
  id: ReportType;
  label: string;
  icon: React.ElementType;
  description: string;
  group: string;
  hasDateRange?: boolean;
  extraFilters?: ExtraFilter[];
}

interface ExtraFilter {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

interface ColDef {
  key: string;
  label: string;
  kind?: "money" | "badge" | "date" | "number" | "text";
}

// ─── Report definitions ────────────────────────────────────────────────────────

const LEAVE_TYPES = [
  { value: "congé_payé", label: "Congé payé" },
  { value: "maladie", label: "Maladie" },
  { value: "RTT", label: "RTT" },
  { value: "maternité", label: "Maternité" },
  { value: "paternité", label: "Paternité" },
  { value: "sans_solde", label: "Sans solde" },
  { value: "formation", label: "Formation" },
  { value: "exceptionnel", label: "Exceptionnel" },
];

const LEAVE_STATUS = [
  { value: "pending", label: "En attente" },
  { value: "approved", label: "Approuvé" },
  { value: "rejected", label: "Refusé" },
  { value: "cancelled", label: "Annulé" },
];

const FLAG_KINDS = [
  { value: "late", label: "Retard" },
  { value: "early_leave", label: "Départ anticipé" },
  { value: "missing_clock_out", label: "Oubli pointage sortie" },
  { value: "missing_clock_in", label: "Oubli pointage entrée" },
  { value: "long_break", label: "Pause longue" },
  { value: "out_of_zone", label: "Hors zone" },
  { value: "suspicious", label: "Suspect" },
];

const CONTRACT_TYPES = [
  { value: "CDI", label: "CDI" },
  { value: "CDD", label: "CDD" },
  { value: "stage", label: "Stage" },
  { value: "prestation", label: "Prestation" },
  { value: "mission", label: "Mission" },
];

const CONTRACT_STATUS = [
  { value: "active", label: "Actif" },
  { value: "draft", label: "Brouillon" },
  { value: "suspended", label: "Suspendu" },
  { value: "terminated", label: "Résilié" },
  { value: "expired", label: "Expiré" },
];

const MOVEMENT_TYPES = [
  { value: "promotion", label: "Promotion" },
  { value: "mutation", label: "Mutation" },
  { value: "reclassification", label: "Reclassification" },
  { value: "departure", label: "Départ" },
  { value: "retirement", label: "Retraite" },
  { value: "disciplinary", label: "Disciplinaire" },
];

const COLLAB_STATUS = [
  { value: "active", label: "Actif" },
  { value: "on_leave", label: "En congé" },
  { value: "suspended", label: "Suspendu" },
  { value: "terminated", label: "Terminé" },
];

const PAYSLIP_STATUS = [
  { value: "draft", label: "Brouillon" },
  { value: "validated", label: "Validé" },
  { value: "paid", label: "Payé" },
];

const REPORT_GROUPS: { label: string; reports: ReportDef[] }[] = [
  {
    label: "Présence",
    reports: [
      { id: "attendance", label: "Présences", icon: CheckCircle2, description: "Jours présents par collaborateur", group: "Présence", hasDateRange: true },
      { id: "lateness", label: "Retards & anomalies", icon: AlertTriangle, description: "Anomalies de pointage détectées", group: "Présence", hasDateRange: true, extraFilters: [{ key: "kind", label: "Type", options: FLAG_KINDS }] },
      { id: "worked-hours", label: "Heures travaillées", icon: Clock, description: "Détail des heures journalières", group: "Présence", hasDateRange: true },
      { id: "leaves", label: "Congés & absences", icon: CalendarOff, description: "Toutes les demandes de congé", group: "Présence", hasDateRange: true, extraFilters: [{ key: "type", label: "Type de congé", options: LEAVE_TYPES }, { key: "status", label: "Statut", options: LEAVE_STATUS }] },
    ],
  },
  {
    label: "Paie",
    reports: [
      { id: "payroll", label: "Bulletin de paie", icon: Banknote, description: "Salaires brut/net et charges", group: "Paie", extraFilters: [{ key: "status", label: "Statut", options: PAYSLIP_STATUS }] },
    ],
  },
  {
    label: "Effectifs",
    reports: [
      { id: "headcount", label: "Effectifs", icon: Users, description: "Liste complète des collaborateurs", group: "Effectifs", extraFilters: [{ key: "status", label: "Statut", options: COLLAB_STATUS }, { key: "contractType", label: "Type contrat", options: CONTRACT_TYPES }] },
    ],
  },
  {
    label: "Administratif",
    reports: [
      { id: "contracts", label: "Contrats", icon: FileSignature, description: "Contrats actifs et expirations", group: "Administratif", extraFilters: [{ key: "type", label: "Type", options: CONTRACT_TYPES }, { key: "status", label: "Statut", options: CONTRACT_STATUS }] },
      { id: "movements", label: "Mouvements", icon: ArrowRightLeft, description: "Promotions, mutations, départs", group: "Administratif", hasDateRange: true, extraFilters: [{ key: "type", label: "Type", options: MOVEMENT_TYPES }] },
    ],
  },
];

const ALL_REPORTS: ReportDef[] = REPORT_GROUPS.flatMap(g => g.reports);

// ─── Column definitions ────────────────────────────────────────────────────────

const COLUMNS: Record<ReportType, ColDef[]> = {
  attendance: [
    { key: "collaborateur", label: "Collaborateur" },
    { key: "departement", label: "Département" },
    { key: "joursPresents", label: "Jours présents", kind: "number" },
    { key: "totalHeures", label: "Total heures", kind: "number" },
    { key: "retards", label: "Retards", kind: "number" },
    { key: "departAnticipe", label: "Départs anticipés", kind: "number" },
  ],
  lateness: [
    { key: "collaborateur", label: "Collaborateur" },
    { key: "departement", label: "Département" },
    { key: "date", label: "Date", kind: "date" },
    { key: "anomalie", label: "Type d'anomalie", kind: "badge" },
    { key: "severite", label: "Sévérité", kind: "badge" },
    { key: "resolu", label: "Résolu", kind: "badge" },
    { key: "description", label: "Description" },
  ],
  "worked-hours": [
    { key: "collaborateur", label: "Collaborateur" },
    { key: "departement", label: "Département" },
    { key: "date", label: "Date", kind: "date" },
    { key: "entree", label: "Entrée" },
    { key: "sortie", label: "Sortie" },
    { key: "heuresEffectives", label: "Heures eff.", kind: "number" },
    { key: "heuresPrevues", label: "Prévues", kind: "number" },
    { key: "heuresSupp", label: "Heures supp.", kind: "number" },
    { key: "heuresPauses", label: "Pauses (h)", kind: "number" },
  ],
  leaves: [
    { key: "collaborateur", label: "Collaborateur" },
    { key: "departement", label: "Département" },
    { key: "type", label: "Type de congé", kind: "badge" },
    { key: "debut", label: "Début", kind: "date" },
    { key: "fin", label: "Fin", kind: "date" },
    { key: "jours", label: "Jours", kind: "number" },
    { key: "statut", label: "Statut", kind: "badge" },
    { key: "raison", label: "Raison" },
  ],
  headcount: [
    { key: "collaborateur", label: "Collaborateur" },
    { key: "departement", label: "Département" },
    { key: "poste", label: "Poste" },
    { key: "typeContrat", label: "Contrat", kind: "badge" },
    { key: "dateEmbauche", label: "Embauche", kind: "date" },
    { key: "statut", label: "Statut", kind: "badge" },
    { key: "salaireBase", label: "Salaire de base", kind: "money" },
  ],
  payroll: [
    { key: "collaborateur", label: "Collaborateur" },
    { key: "departement", label: "Département" },
    { key: "periode", label: "Période" },
    { key: "brut", label: "Brut", kind: "money" },
    { key: "net", label: "Net", kind: "money" },
    { key: "cnssCollab", label: "CNSS salarié", kind: "money" },
    { key: "cnssPatronal", label: "CNSS patronal", kind: "money" },
    { key: "irpp", label: "IRPP", kind: "money" },
    { key: "statut", label: "Statut", kind: "badge" },
  ],
  contracts: [
    { key: "collaborateur", label: "Collaborateur" },
    { key: "departement", label: "Département" },
    { key: "type", label: "Type", kind: "badge" },
    { key: "statut", label: "Statut", kind: "badge" },
    { key: "debut", label: "Début", kind: "date" },
    { key: "fin", label: "Fin", kind: "date" },
    { key: "salaireMensuel", label: "Salaire mensuel", kind: "money" },
    { key: "poste", label: "Poste" },
  ],
  movements: [
    { key: "collaborateur", label: "Collaborateur" },
    { key: "type", label: "Type", kind: "badge" },
    { key: "dateEffet", label: "Date d'effet", kind: "date" },
    { key: "departementPrecedent", label: "Dept. précédent" },
    { key: "departementActuel", label: "Dept. actuel" },
    { key: "salairePrecedent", label: "Salaire préc.", kind: "money" },
    { key: "nouveauSalaire", label: "Nouveau salaire", kind: "money" },
    { key: "motif", label: "Motif" },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function thisMonth() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function firstOfMonth() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-01`;
}

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function exportCSV(rows: Record<string, unknown>[], cols: ColDef[], filename: string) {
  const header = cols.map(c => `"${c.label}"`).join(",");
  const body = rows.map(row =>
    cols.map(c => `"${row[c.key] ?? ""}"`).join(",")
  ).join("\n");
  const blob = new Blob([`\uFEFF${header}\n${body}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function badgeVariant(key: string, val: unknown): string {
  const v = String(val ?? "").toLowerCase();
  if (key === "severite") {
    if (v === "high") return "bg-red-100 text-red-700";
    if (v === "medium") return "bg-amber-100 text-amber-700";
    return "bg-slate-100 text-slate-600";
  }
  if (key === "statut" || key === "status") {
    if (["active", "actif", "approved", "paid", "validated"].some(x => v.includes(x))) return "bg-emerald-100 text-emerald-700";
    if (["pending", "draft"].some(x => v.includes(x))) return "bg-amber-100 text-amber-700";
    if (["rejected", "terminated", "expired"].some(x => v.includes(x))) return "bg-red-100 text-red-700";
  }
  if (key === "resolu") return val === "Oui" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600";
  return "bg-slate-100 text-slate-600";
}

function renderCell(col: ColDef, val: unknown) {
  if (val == null || val === "") return <span className="text-slate-400">—</span>;
  if (col.kind === "money") {
    const n = Number(val);
    return <span className="font-medium tabular-nums">{isNaN(n) ? "—" : formatFCFA(n)}</span>;
  }
  if (col.kind === "badge") {
    return (
      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", badgeVariant(col.key, val))}>
        {String(val)}
      </span>
    );
  }
  if (col.kind === "date") {
    const d = String(val);
    if (!d || d === "—") return <span className="text-slate-400">—</span>;
    const parts = d.split("T")[0];
    const [y, m, day] = parts.split("-");
    return <span className="tabular-nums">{day}/{m}/{y}</span>;
  }
  if (col.kind === "number") return <span className="tabular-nums font-medium">{String(val)}</span>;
  return <span>{String(val)}</span>;
}

// ─── MultiSelect ──────────────────────────────────────────────────────────────

function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Tous",
  className,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]);

  const label =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? (options.find(o => o.value === selected[0])?.label ?? "1 sélectionné")
        : `${selected.length} sélectionnés`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "h-9 min-w-44 flex items-center justify-between gap-2 rounded-lg border px-3 text-sm bg-white transition-colors",
            selected.length > 0
              ? "border-orange-300 text-orange-700 hover:bg-orange-50"
              : "border-slate-200 text-slate-700 hover:bg-slate-50",
            className
          )}
        >
          <span className="truncate max-w-[140px]">{label}</span>
          <div className="flex items-center gap-1 shrink-0">
            {selected.length > 0 && (
              <span
                role="button"
                tabIndex={0}
                onClick={e => { e.stopPropagation(); onChange([]); }}
                onKeyDown={e => { if (e.key === "Enter") { e.stopPropagation(); onChange([]); } }}
                className="rounded p-0.5 hover:bg-orange-100"
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2 shadow-lg" align="start">
        <div className="max-h-64 overflow-y-auto space-y-0.5">
          {options.map(opt => {
            const checked = selected.includes(opt.value);
            return (
              <label
                key={opt.value}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-slate-50 cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(opt.value)}
                  className="h-3.5 w-3.5 accent-orange-500 rounded"
                />
                <span className={cn("text-sm", checked ? "font-medium text-slate-800" : "text-slate-600")}>
                  {opt.label}
                </span>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function HrReports() {
  const [reportType, setReportType] = useState<ReportType>("attendance");
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(thisMonth());
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([]);
  const [period, setPeriod] = useState(currentPeriod());
  const [expiringBefore, setExpiringBefore] = useState("");
  const [extraFilters, setExtraFilters] = useState<Record<string, string>>({});

  const def = ALL_REPORTS.find(r => r.id === reportType)!;
  const cols = COLUMNS[reportType];

  // ── Reference data ──
  const { data: depts } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["hr/departments"],
    queryFn: () => apiFetch<{ data: { id: string; name: string }[] }>("/api/hr/departments").then(r => r.data),
  });
  const { data: collabs } = useQuery<{ id: string; firstName: string; lastName: string }[]>({
    queryKey: ["collaborators-list"],
    queryFn: () => apiFetch<{ data: { id: string; firstName: string; lastName: string }[] }>("/api/collaborators?limit=200").then(r => r.data),
  });

  // ── Build query params ──
  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (departmentIds.length > 0) p.set("departmentIds", departmentIds.join(","));
    if (collaboratorIds.length > 0) p.set("collaboratorIds", collaboratorIds.join(","));
    if (def.hasDateRange) { if (from) p.set("from", from); if (to) p.set("to", to); }
    if (reportType === "payroll" && period) p.set("period", period);
    if (reportType === "contracts" && expiringBefore) p.set("expiringBefore", expiringBefore);
    for (const [k, v] of Object.entries(extraFilters)) { if (v) p.set(k, v); }
    return p.toString();
  }, [reportType, departmentIds, collaboratorIds, from, to, period, expiringBefore, extraFilters, def.hasDateRange]);

  const { data, isLoading, refetch } = useQuery<{ count: number; rows: Record<string, unknown>[]; totals?: Record<string, number> }>({
    queryKey: ["hr-reports", reportType, params],
    queryFn: () => apiFetch(`/api/hr/reports/${reportType}?${params}`),
  });

  const rows = data?.rows ?? [];
  const totals = data?.totals;

  function handleExtraFilter(key: string, val: string) {
    setExtraFilters(prev => ({ ...prev, [key]: val }));
  }

  function handleReportChange(id: ReportType) {
    setReportType(id);
    setExtraFilters({});
    setDepartmentIds([]);
    setCollaboratorIds([]);
  }

  // ── KPI cards ──
  const kpiCards: { label: string; value: string; sub?: string }[] = useMemo(() => {
    const count = data?.count ?? 0;
    const cards: { label: string; value: string; sub?: string }[] = [
      { label: "Enregistrements", value: String(count) },
    ];
    if (!totals) return cards;
    if (reportType === "attendance") {
      cards.push({ label: "Jours présents (total)", value: String(totals.joursPresents ?? 0) });
      cards.push({ label: "Heures effectives", value: `${totals.totalHeures ?? 0} h` });
      cards.push({ label: "Retards", value: String(totals.retards ?? 0) });
    } else if (reportType === "worked-hours") {
      cards.push({ label: "Total heures eff.", value: `${totals.totalEffectif ?? 0} h` });
      cards.push({ label: "Total heures supp.", value: `${totals.totalSupp ?? 0} h` });
    } else if (reportType === "leaves") {
      cards.push({ label: "Total jours d'absence", value: `${totals.totalJours ?? 0} j` });
    } else if (reportType === "payroll") {
      cards.push({ label: "Masse salariale brute", value: formatFCFA(totals.brut ?? 0) });
      cards.push({ label: "Masse salariale nette", value: formatFCFA(totals.net ?? 0) });
      cards.push({ label: "CNSS patronal total", value: formatFCFA(totals.cnssPatronal ?? 0) });
    }
    return cards;
  }, [data, totals, reportType]);

  return (
    <HrShell title="Rapports RH" subtitle="Analyse et export des données RH">
      <div className="flex flex-col gap-5 p-6">

        {/* ── Report type selector ── */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex flex-wrap gap-5">
            {REPORT_GROUPS.map(group => (
              <div key={group.label} className="flex flex-col gap-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-1">{group.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.reports.map(r => {
                    const Icon = r.icon;
                    const active = reportType === r.id;
                    return (
                      <button
                        key={r.id}
                        onClick={() => handleReportChange(r.id)}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                          active
                            ? "bg-orange-500 text-white shadow-sm"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex flex-wrap items-end gap-3">

            {/* Date range */}
            {def.hasDateRange && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500">Du</label>
                  <input
                    type="date" value={from}
                    onChange={e => setFrom(e.target.value)}
                    className="h-9 rounded-lg border border-slate-200 px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500">Au</label>
                  <input
                    type="date" value={to}
                    onChange={e => setTo(e.target.value)}
                    className="h-9 rounded-lg border border-slate-200 px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </>
            )}

            {/* Payroll period */}
            {reportType === "payroll" && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Période</label>
                <input
                  type="month" value={period}
                  onChange={e => setPeriod(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
            )}

            {/* Contract expiry */}
            {reportType === "contracts" && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Expire avant</label>
                <input
                  type="date" value={expiringBefore}
                  onChange={e => setExpiringBefore(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
            )}

            {/* Department — multi-select */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Département</label>
              <MultiSelect
                options={(depts ?? []).map(d => ({ value: d.id, label: d.name }))}
                selected={departmentIds}
                onChange={setDepartmentIds}
                placeholder="Tous les départements"
                className="w-52"
              />
            </div>

            {/* Collaborator — multi-select */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Collaborateur</label>
              <MultiSelect
                options={(collabs ?? []).map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }))}
                selected={collaboratorIds}
                onChange={setCollaboratorIds}
                placeholder="Tous les collaborateurs"
                className="w-52"
              />
            </div>

            {/* Extra filters per report type */}
            {(def.extraFilters ?? []).map(f => (
              <div key={f.key} className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">{f.label}</label>
                <Select
                  value={extraFilters[f.key] || "__all__"}
                  onValueChange={v => handleExtraFilter(f.key, v === "__all__" ? "" : v)}
                >
                  <SelectTrigger className="h-9 w-40 text-sm"><SelectValue placeholder="Tous" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tous</SelectItem>
                    {f.options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}

            {/* Actions */}
            <div className="flex items-end gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={() => refetch()} className="h-9 gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                Actualiser
              </Button>
              <Button
                size="sm"
                disabled={rows.length === 0}
                onClick={() => exportCSV(rows, cols, `rapport-rh-${reportType}-${new Date().toISOString().slice(0, 10)}.csv`)}
                className="h-9 gap-1.5 bg-orange-500 hover:bg-orange-600"
              >
                <Download className="h-3.5 w-3.5" />
                Exporter CSV
              </Button>
            </div>
          </div>
        </div>

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {kpiCards.map(card => (
            <Card key={card.label} className="border-slate-200 shadow-none">
              <CardContent className="p-4">
                <p className="text-xs text-slate-500 mb-1">{card.label}</p>
                <p className="text-xl font-bold text-slate-800">{card.value}</p>
                {card.sub && <p className="text-xs text-slate-400 mt-0.5">{card.sub}</p>}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Table ── */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <FileBarChart2 className="h-4 w-4 text-orange-500" />
              <span className="font-semibold text-slate-800 text-sm">{def.label}</span>
              <span className="text-xs text-slate-400">{def.description}</span>
            </div>
            {!isLoading && (
              <Badge variant="secondary" className="text-xs">{rows.length} résultat{rows.length !== 1 ? "s" : ""}</Badge>
            )}
          </div>

          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-40 text-slate-400 text-sm gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Chargement du rapport…
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-400">
                <FileBarChart2 className="h-8 w-8 opacity-30" />
                <p className="text-sm">Aucune donnée pour cette sélection</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {cols.map(col => (
                      <th key={col.key} className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5 whitespace-nowrap">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      {cols.map(col => (
                        <td key={col.key} className="px-4 py-2.5 text-slate-700 whitespace-nowrap">
                          {renderCell(col, row[col.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </HrShell>
  );
}
