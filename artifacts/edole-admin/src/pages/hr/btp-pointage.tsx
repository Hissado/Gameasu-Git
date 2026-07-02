/**
 * Pointage & Paie BTP — Grille de pointage journalier
 * Modèle : Excel "Pointage BTP" — période 26→25, statuts P/H/M/A/C
 */
import React, { useState, useMemo, useRef } from "react";
import { HrShell } from "./_layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { formatFCFA } from "@/lib/format";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Save, Calculator, Upload, Lock, Unlock, RefreshCw,
  Calendar, Users, ChevronRight, AlertCircle, CheckCircle, FileSpreadsheet, Wifi,
} from "lucide-react";

const API = "/api";

async function fetchJSON(url: string, opts?: RequestInit) {
  const token = localStorage.getItem("auth_token");
  const r = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts?.headers },
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error ?? r.statusText); }
  return r.json();
}

// ─── Constantes ─────────────────────────────────────────────────────────────

const STATUSES = [
  { code: "present", label: "P", color: "bg-emerald-100 text-emerald-800 border-emerald-300", title: "Présent" },
  { code: "holiday", label: "H", color: "bg-amber-100 text-amber-700 border-amber-300", title: "Jour Férié" },
  { code: "sick",    label: "M", color: "bg-blue-100 text-blue-700 border-blue-300", title: "Maladie" },
  { code: "absent",  label: "A", color: "bg-red-100 text-red-700 border-red-300", title: "Absent" },
  { code: "leave",   label: "C", color: "bg-purple-100 text-purple-700 border-purple-300", title: "Congé" },
];
const STATUS_MAP = Object.fromEntries(STATUSES.map((s) => [s.code, s]));
const DOW_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

type Period = {
  id: string; label: string; startDate: string; endDate: string;
  totalWorkingDays: number | null; status: string; notes?: string;
};
type Collaborator = {
  id: string; firstName: string; lastName: string; employeeNumber?: string;
  baseSalary?: string;
};
type AttendanceLine = {
  collaboratorId: string; recordDate: string; status: string;
  hoursWorked: string; overtimeHours: string; overtime100Hours: string;
};

// Cellule de statut dans la grille
type CellKey = `${string}:${string}`; // collaboratorId:date
type CellValue = { status: string; hoursWorked: number; overtimeHours: number };

function formatDate(s: string) {
  const d = new Date(s);
  return `${DOW_FR[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

function getDatesInRange(start: string, end: string): Date[] {
  const dates: Date[] = [];
  const d = new Date(start);
  const e = new Date(end);
  while (d <= e) {
    dates.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function isSunday(d: Date) { return d.getDay() === 0; }
function isSaturday(d: Date) { return d.getDay() === 6; }

// ─── Composant grille pour UN collaborateur ──────────────────────────────────

function CollabRow({
  collab, dates, cells, onCell, locked,
}: {
  collab: Collaborator;
  dates: Date[];
  cells: Map<CellKey, CellValue>;
  onCell: (collabId: string, date: string, val: Partial<CellValue>) => void;
  locked: boolean;
}) {
  const name = `${collab.lastName} ${collab.firstName}`;

  // Statistiques de la ligne
  const stats = useMemo(() => {
    let p = 0, h = 0, m = 0, a = 0, c = 0, totalH = 0, totalOT = 0;
    for (const date of dates) {
      const key = `${collab.id}:${date.toISOString().slice(0, 10)}` as CellKey;
      const cell = cells.get(key);
      if (!cell) continue;
      switch (cell.status) {
        case "present": p++; totalH += cell.hoursWorked; totalOT += cell.overtimeHours; break;
        case "holiday": h++; break;
        case "sick": m++; break;
        case "absent": a++; break;
        case "leave": c++; break;
      }
    }
    return { p, h, m, a, c, totalH, totalOT };
  }, [cells, collab.id, dates]);

  return (
    <tr className="group hover:bg-orange-50/30 transition-colors">
      {/* Nom */}
      <td className="sticky left-0 z-10 bg-white border border-gray-200 px-2 py-1 min-w-[160px] max-w-[160px]">
        <div className="truncate text-xs font-medium text-gray-800" title={name}>{name}</div>
        {collab.employeeNumber && (
          <div className="text-[10px] text-gray-400">{collab.employeeNumber}</div>
        )}
      </td>

      {/* Cases journalières */}
      {dates.map((date) => {
        const dateStr = date.toISOString().slice(0, 10);
        const key = `${collab.id}:${dateStr}` as CellKey;
        const cell = cells.get(key) ?? { status: "present", hoursWorked: 8, overtimeHours: 0 };
        const isWeekend = isSunday(date) || isSaturday(date);
        const st = STATUS_MAP[cell.status] ?? STATUS_MAP.present;

        return (
          <td
            key={dateStr}
            className={`border border-gray-200 text-center p-0 ${isWeekend ? "bg-amber-50" : ""}`}
          >
            <div className="flex flex-col items-center gap-0.5 py-0.5">
              {/* Bouton statut */}
              {locked ? (
                <span className={`text-[10px] font-bold px-1 py-0.5 rounded border ${st.color}`}>
                  {st.label}
                </span>
              ) : (
                <select
                  value={cell.status}
                  onChange={(e) => onCell(collab.id, dateStr, { status: e.target.value })}
                  className={`text-[10px] font-bold border rounded w-8 text-center py-0 cursor-pointer ${st.color} appearance-none`}
                  title={st.title}
                >
                  {STATUSES.map((s) => (
                    <option key={s.code} value={s.code}>{s.label}</option>
                  ))}
                </select>
              )}
              {/* Heures normales (si présent) */}
              {cell.status === "present" && (
                <input
                  type="number"
                  min={0} max={24} step={0.5}
                  value={cell.hoursWorked}
                  onChange={(e) => onCell(collab.id, dateStr, { hoursWorked: parseFloat(e.target.value) || 0 })}
                  disabled={locked}
                  className="w-8 text-[10px] text-center border border-gray-200 rounded bg-white disabled:bg-gray-50"
                  title="Heures travaillées"
                />
              )}
              {/* HS (si présent) */}
              {cell.status === "present" && (
                <input
                  type="number"
                  min={0} max={16} step={0.5}
                  value={cell.overtimeHours || ""}
                  onChange={(e) => onCell(collab.id, dateStr, { overtimeHours: parseFloat(e.target.value) || 0 })}
                  disabled={locked}
                  placeholder="HS"
                  className="w-8 text-[10px] text-center border border-dashed border-orange-300 rounded bg-orange-50/50 disabled:bg-gray-50 placeholder:text-gray-300"
                  title="Heures supplémentaires"
                />
              )}
            </div>
          </td>
        );
      })}

      {/* Totaux */}
      <td className="border border-gray-200 text-center text-[11px] font-bold text-emerald-700 px-1">{stats.p}</td>
      <td className="border border-gray-200 text-center text-[11px] text-amber-600 px-1">{stats.h}</td>
      <td className="border border-gray-200 text-center text-[11px] text-red-500 px-1">{stats.a}</td>
      <td className="border border-gray-200 text-center text-[11px] text-purple-600 px-1">{stats.c}</td>
      <td className="border border-gray-200 text-center text-[11px] font-semibold text-gray-700 px-1">{stats.totalH}h</td>
      <td className="border border-gray-200 text-center text-[11px] font-semibold text-orange-600 px-1">{stats.totalOT}h</td>
    </tr>
  );
}

// ─── Composant principal ─────────────────────────────────────────────────────

export default function BtpPointage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [cells, setCells] = useState<Map<CellKey, CellValue>>(new Map());
  const [dirty, setDirty] = useState(false);
  const [newPeriodOpen, setNewPeriodOpen] = useState(false);
  const [newForm, setNewForm] = useState({ label: "", startDate: "", endDate: "", notes: "", payGroupId: "" });

  // ── Groupes de paie ───────────────────────────────────────────────────
  const { data: payGroups = [] } = useQuery<any[]>({
    queryKey: ["btp-groups"],
    queryFn: () => fetchJSON(`${API}/btp/groups`),
  });

  // ── Périodes ──────────────────────────────────────────────────────────
  const { data: periods = [], isLoading: periodsLoading } = useQuery<Period[]>({
    queryKey: ["btp-periods"],
    queryFn: () => fetchJSON(`${API}/btp/periods`),
  });

  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId);

  // Auto-calcul des dates quand on saisit un mois et qu'un groupe est sélectionné
  function applyGroupDates(month: string, groupId: string) {
    const grp = payGroups.find((g: any) => g.id === groupId);
    if (!month || month.length < 7) return;
    const [y, m] = month.split("-").map(Number);
    if (!y || !m) return;
    const startDay = grp?.periodStartDay ?? 26;
    const endDay = grp?.periodEndDay ?? 25;
    // Période : startDay du mois précédent → endDay du mois courant
    const prevMonth = m === 1 ? 12 : m - 1;
    const prevYear = m === 1 ? y - 1 : y;
    const pad = (n: number) => String(n).padStart(2, "0");
    const startDate = `${prevYear}-${pad(prevMonth)}-${pad(startDay)}`;
    const endDate = `${y}-${pad(m)}-${pad(endDay)}`;
    setNewForm((f) => ({ ...f, startDate, endDate }));
  }

  // ── Données de pointage ───────────────────────────────────────────────
  const { data: attendanceData, isLoading: attendanceLoading } = useQuery<{
    period: Period;
    collaborators: Collaborator[];
    lines: AttendanceLine[];
  }>({
    queryKey: ["btp-attendance", selectedPeriodId],
    queryFn: () => fetchJSON(`${API}/btp/periods/${selectedPeriodId}/attendance`),
    enabled: !!selectedPeriodId,
  });

  // Charger les lignes existantes dans la map locale quand les données arrivent
  React.useEffect(() => {
    if (!attendanceData) return;
    const map = new Map<CellKey, CellValue>();
    for (const l of attendanceData.lines) {
      map.set(`${l.collaboratorId}:${l.recordDate}` as CellKey, {
        status: l.status,
        hoursWorked: parseFloat(l.hoursWorked) || 8,
        overtimeHours: parseFloat(l.overtimeHours) || 0,
      });
    }
    setCells(map);
    setDirty(false);
  }, [attendanceData]);

  // ── Dates de la période ───────────────────────────────────────────────
  const dates = useMemo(() => {
    if (!selectedPeriod) return [];
    return getDatesInRange(selectedPeriod.startDate, selectedPeriod.endDate);
  }, [selectedPeriod]);

  // ── Mutations ─────────────────────────────────────────────────────────
  const createPeriodMut = useMutation({
    mutationFn: (body: any) => fetchJSON(`${API}/btp/periods`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["btp-periods"] });
      setSelectedPeriodId(p.id);
      setNewPeriodOpen(false);
      toast({ title: "Période créée", description: p.label });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const saveMut = useMutation({
    mutationFn: (lines: any[]) =>
      fetchJSON(`${API}/btp/periods/${selectedPeriodId}/attendance`, { method: "PUT", body: JSON.stringify({ lines }) }),
    onSuccess: () => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["btp-attendance", selectedPeriodId] });
      toast({ title: "Pointage sauvegardé" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const calculateMut = useMutation({
    mutationFn: () => fetchJSON(`${API}/btp/periods/${selectedPeriodId}/calculate`, { method: "POST" }),
    onSuccess: (r) => {
      toast({ title: `Paie calculée pour ${r.calculated} agents` });
      qc.invalidateQueries({ queryKey: ["btp-attendance", selectedPeriodId] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erreur de calcul", description: e.message }),
  });

  const lockMut = useMutation({
    mutationFn: (status: string) =>
      fetchJSON(`${API}/btp/periods/${selectedPeriodId}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["btp-periods"] });
      toast({ title: "Statut mis à jour" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const prefillKioskMut = useMutation({
    mutationFn: () =>
      fetchJSON(`${API}/btp/periods/${selectedPeriodId}/prefill-from-kiosk`, { method: "POST" }),
    onSuccess: (r: { prefilled: number; skipped: number; message: string }) => {
      qc.invalidateQueries({ queryKey: ["btp-attendance", selectedPeriodId] });
      toast({
        title: `${r.prefilled} ligne(s) importée(s) du Kiosk`,
        description: r.skipped > 0 ? `${r.skipped} déjà saisie(s), non modifiée(s)` : r.message,
      });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erreur import Kiosk", description: e.message }),
  });

  // ── Mise à jour cellule ───────────────────────────────────────────────
  function handleCell(collabId: string, date: string, val: Partial<CellValue>) {
    const key = `${collabId}:${date}` as CellKey;
    const current = cells.get(key) ?? { status: "present", hoursWorked: 8, overtimeHours: 0 };
    const next = { ...current, ...val };
    // Reset heures si statut non présent
    if (val.status && val.status !== "present") { next.hoursWorked = 0; next.overtimeHours = 0; }
    const newMap = new Map(cells);
    newMap.set(key, next);
    setCells(newMap);
    setDirty(true);
  }

  function handleSave() {
    if (!attendanceData) return;
    const lines: any[] = [];
    const collabList = (attendanceData as { collaborators: Collaborator[] }).collaborators;
    for (const collab of collabList) {
      for (const date of dates) {
        const dateStr = date.toISOString().slice(0, 10);
        const key = `${collab.id}:${dateStr}` as CellKey;
        const cell = cells.get(key);
        if (!cell) continue;
        lines.push({
          collaboratorId: collab.id,
          recordDate: dateStr,
          status: cell.status,
          hoursWorked: cell.hoursWorked,
          overtimeHours: cell.overtimeHours,
          overtime100Hours: 0,
        });
      }
    }
    saveMut.mutate(lines);
  }

  // ── Génération du label période automatique ───────────────────────────
  function suggestPeriod() {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 26);
    const thisMonth25 = new Date(now.getFullYear(), now.getMonth(), 25);
    const label = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    setNewForm((f) => ({
      ...f,
      label,
      startDate: prevMonth.toISOString().slice(0, 10),
      endDate: thisMonth25.toISOString().slice(0, 10),
      notes: "",
    }));
  }

  const locked = selectedPeriod?.status === "locked";
  const collabs: Collaborator[] = (attendanceData as { collaborators: Collaborator[] } | undefined)?.collaborators ?? [];

  const PERIOD_STATUS_COLOR: Record<string, string> = {
    draft: "bg-amber-50 text-amber-700 border-amber-200",
    open: "bg-blue-50 text-blue-700 border-blue-200",
    locked: "bg-gray-100 text-gray-600 border-gray-300",
  };
  const PERIOD_STATUS_LABEL: Record<string, string> = {
    draft: "Brouillon", open: "Ouverte", locked: "Verrouillée",
  };

  return (
    <HrShell
      title="Grille de pointage"
      subtitle="Présences journalières — période 26→25"
      actions={
        <div className="flex items-center gap-2">
          {selectedPeriodId && !locked && dirty && (
            <Button size="sm" onClick={handleSave} disabled={saveMut.isPending}>
              <Save className="w-4 h-4 mr-1" />
              {saveMut.isPending ? "Sauvegarde…" : "Sauvegarder"}
            </Button>
          )}
          {selectedPeriodId && !locked && (
            <Button
              size="sm" variant="outline"
              onClick={() => prefillKioskMut.mutate()}
              disabled={prefillKioskMut.isPending}
              title="Importer les badgeages du Kiosk pour pré-remplir la grille (ne remplace pas les saisies existantes)"
            >
              <Wifi className="w-4 h-4 mr-1" />
              {prefillKioskMut.isPending ? "Import…" : "Importer du Kiosk"}
            </Button>
          )}
          {selectedPeriodId && !locked && (
            <Button size="sm" variant="outline" onClick={() => calculateMut.mutate()} disabled={calculateMut.isPending}>
              <Calculator className="w-4 h-4 mr-1" />
              {calculateMut.isPending ? "Calcul…" : "Calculer la paie"}
            </Button>
          )}
          {selectedPeriodId && (
            <>
              <Button
                size="sm" variant="outline"
                onClick={() => window.open(`${API}/btp/periods/${selectedPeriodId}/export/pointage.xlsx?token=${localStorage.getItem("auth_token")}`, "_blank")}
              >
                <FileSpreadsheet className="w-4 h-4 mr-1" />Pointage XLS
              </Button>
              <Button
                size="sm" variant="outline"
                onClick={() => window.open(`${API}/btp/periods/${selectedPeriodId}/export/salaires.xlsx?token=${localStorage.getItem("auth_token")}`, "_blank")}
              >
                <Upload className="w-4 h-4 mr-1" />Salaires XLS
              </Button>
            </>
          )}
          {selectedPeriodId && !locked && (
            <Button size="sm" variant="outline" onClick={() => lockMut.mutate("locked")}>
              <Lock className="w-4 h-4 mr-1" />Verrouiller
            </Button>
          )}
          {selectedPeriodId && locked && (
            <Button size="sm" variant="outline" onClick={() => lockMut.mutate("open")}>
              <Unlock className="w-4 h-4 mr-1" />Déverrouiller
            </Button>
          )}
          <Button size="sm" onClick={() => { suggestPeriod(); setNewPeriodOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" />Nouvelle période
          </Button>
        </div>
      }
    >
      <div className="flex gap-4 h-full min-h-0">
        {/* ── Panneau gauche : liste des périodes ────────────────────── */}
        <div className="w-56 shrink-0 flex flex-col gap-2">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">Périodes</div>
          {periodsLoading ? (
            <div className="text-sm text-gray-400 px-1">Chargement…</div>
          ) : periods.length === 0 ? (
            <div className="text-sm text-gray-400 px-1">Aucune période</div>
          ) : (
            periods.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPeriodId(p.id)}
                className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${
                  p.id === selectedPeriodId
                    ? "border-orange-400 bg-orange-50 shadow-sm"
                    : "border-gray-200 hover:border-orange-200 hover:bg-orange-50/50"
                }`}
              >
                <div className="font-semibold text-gray-800">{p.label}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {p.startDate} → {p.endDate}
                </div>
                <Badge className={`text-[10px] mt-1 ${PERIOD_STATUS_COLOR[p.status] ?? "bg-gray-100 text-gray-600"}`}>
                  {PERIOD_STATUS_LABEL[p.status] ?? p.status}
                </Badge>
              </button>
            ))
          )}
        </div>

        {/* ── Zone centrale : grille ──────────────────────────────────── */}
        <div className="flex-1 min-w-0 overflow-auto">
          {!selectedPeriodId ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
              <Calendar className="w-12 h-12 opacity-30" />
              <div className="text-sm">Sélectionnez ou créez une période de paie</div>
              <Button size="sm" onClick={() => { suggestPeriod(); setNewPeriodOpen(true); }}>
                <Plus className="w-4 h-4 mr-1" />Créer la première période
              </Button>
            </div>
          ) : attendanceLoading ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />Chargement du pointage…
            </div>
          ) : (
            <div className="relative">
              {/* En-tête période */}
              <div className="flex items-center gap-3 mb-3">
                <div>
                  <span className="font-semibold text-gray-800">{selectedPeriod?.label}</span>
                  <span className="text-gray-400 text-sm ml-2">
                    {selectedPeriod?.startDate} → {selectedPeriod?.endDate}
                  </span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {collabs.length} agent{collabs.length > 1 ? "s" : ""}
                </Badge>
                {selectedPeriod?.totalWorkingDays && (
                  <Badge variant="outline" className="text-xs text-blue-600">
                    {selectedPeriod.totalWorkingDays} jours ouvrables
                  </Badge>
                )}
                {locked && (
                  <Badge className="bg-gray-100 text-gray-600 border-gray-300 text-xs">
                    <Lock className="w-3 h-3 mr-1" />Verrouillée
                  </Badge>
                )}
                {dirty && !locked && (
                  <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs animate-pulse">
                    Modifications non sauvegardées
                  </Badge>
                )}
              </div>

              {/* Grille */}
              {collabs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
                  <Users className="w-10 h-10 opacity-30" />
                  <div className="text-sm">Aucun collaborateur actif dans cette organisation</div>
                </div>
              ) : (
                <div className="overflow-auto rounded-lg border border-gray-200 shadow-sm">
                  <table className="border-collapse text-xs" style={{ minWidth: `${160 + dates.length * 54 + 200}px` }}>
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="sticky left-0 z-20 bg-gray-50 border border-gray-200 px-2 py-2 text-left min-w-[160px] max-w-[160px] text-xs font-semibold text-gray-600">
                          Agent
                        </th>
                        {dates.map((date) => {
                          const dow = date.getDay();
                          const isSun = isSunday(date);
                          const isSat = isSaturday(date);
                          const isWeekend = isSun || isSat;
                          return (
                            <th
                              key={date.toISOString()}
                              className={`border border-gray-200 text-center px-0.5 py-1 min-w-[50px] ${
                                isWeekend ? "bg-amber-50" : ""
                              }`}
                            >
                              <div className={`text-[9px] font-bold ${isSun ? "text-red-500" : isSat ? "text-orange-500" : "text-gray-500"}`}>
                                {DOW_FR[dow]}
                              </div>
                              <div className="text-[11px] font-semibold text-gray-700">{date.getDate()}</div>
                            </th>
                          );
                        })}
                        {/* Colonnes totaux */}
                        {["P", "H", "A", "C", "H.Norm", "HS"].map((h) => (
                          <th key={h} className="border border-gray-200 text-center px-1 py-2 min-w-[40px] bg-orange-50">
                            <span className="text-[10px] font-bold text-orange-700">{h}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {collabs.map((collab) => (
                        <CollabRow
                          key={collab.id}
                          collab={collab}
                          dates={dates}
                          cells={cells}
                          onCell={handleCell}
                          locked={locked}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Légende */}
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <span className="text-xs text-gray-400">Légende :</span>
                {STATUSES.map((s) => (
                  <span key={s.code} className={`text-[11px] font-bold px-2 py-0.5 rounded border ${s.color}`}>
                    {s.label} = {s.title}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Dialog nouvelle période ─────────────────────────────────────── */}
      <Dialog open={newPeriodOpen} onOpenChange={setNewPeriodOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle période de paie BTP</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            {/* Groupe de paie */}
            {payGroups.length > 0 && (
              <div>
                <Label>Groupe de paie</Label>
                <Select
                  value={newForm.payGroupId}
                  onValueChange={(v) => {
                    setNewForm((f) => ({ ...f, payGroupId: v }));
                    if (newForm.label) applyGroupDates(newForm.label, v);
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Sans groupe (paramètres globaux)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sans groupe (paramètres globaux)</SelectItem>
                    {payGroups.map((g: any) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                        <span className="text-gray-400 text-xs ml-1">
                          (j{g.periodStartDay}→j{g.periodEndDay})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {newForm.payGroupId && (
                  <p className="text-[11px] text-blue-600 mt-1">
                    Les dates seront auto-calculées selon les jours du groupe.
                  </p>
                )}
              </div>
            )}
            <div>
              <Label htmlFor="label">Mois de paie (ex: 2026-06)</Label>
              <Input id="label" value={newForm.label}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewForm((f) => ({ ...f, label: val }));
                  applyGroupDates(val, newForm.payGroupId);
                }}
                placeholder="YYYY-MM" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="startDate">Début</Label>
                <Input id="startDate" type="date" value={newForm.startDate}
                  onChange={(e) => setNewForm((f) => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="endDate">Fin</Label>
                <Input id="endDate" type="date" value={newForm.endDate}
                  onChange={(e) => setNewForm((f) => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" value={newForm.notes}
                onChange={(e) => setNewForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optionnel" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewPeriodOpen(false)}>Annuler</Button>
            <Button
              onClick={() => createPeriodMut.mutate(newForm)}
              disabled={!newForm.label || !newForm.startDate || !newForm.endDate || createPeriodMut.isPending}
            >
              {createPeriodMut.isPending ? "Création…" : "Créer la période"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HrShell>
  );
}
