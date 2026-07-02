/**
 * Paramètres Pointage & Paie BTP — taux CNSS, HS, IRPP, jours fériés
 */
import React, { useState, useEffect } from "react";
import { HrShell } from "./_layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Save, Plus, Trash2, RefreshCw, Settings2, Calendar } from "lucide-react";

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

type Settings = {
  id?: string;
  hoursPerWeek: string; hoursPerDayStandard: string; hourlyRateDivisor: string;
  periodStartDay: number; periodEndDay: number;
  hs20Rate: string; hs40Rate: string; hsSundayRate: string; hsNightRate: string; hsSundayNightRate: string;
  cnssEmployeeRate: string; cnssEmployerRate: string;
  irppAbatementRate: string; irppChargePerDependent: string; irppMaxDependents: number;
  leaveAccrualDaysPerMonth: string; absenceBaseCalendarDays: boolean;
};

type Holiday = { id: string; date: string; label: string; isRecurringYearly: boolean };

function FieldRow({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <div>
        <div className="text-sm font-medium text-gray-700">{label}</div>
        {sub && <div className="text-xs text-gray-400">{sub}</div>}
      </div>
      <div className="w-36">{children}</div>
    </div>
  );
}

function PctInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const pct = (parseFloat(value) * 100).toFixed(2);
  return (
    <div className="relative">
      <Input
        type="number" step={0.01} min={0} max={100}
        value={pct}
        onChange={(e) => onChange(String(parseFloat(e.target.value) / 100))}
        disabled={disabled}
        className="pr-6 text-right text-sm h-8"
      />
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
    </div>
  );
}

// ─── Barème IRPP affiché (informatif) ───────────────────────────────────────
const IRPP_BRACKETS = [
  { from: 0, to: 75000, rate: "0 %" },
  { from: 75001, to: 250000, rate: "3 %" },
  { from: 250001, to: 500000, rate: "10 %" },
  { from: 500001, to: 750000, rate: "15 %" },
  { from: 750001, to: 1000000, rate: "20 %" },
  { from: 1000001, to: 1250000, rate: "25 %" },
  { from: 1250001, to: 1666667, rate: "30 %" },
  { from: 1666668, to: Infinity, rate: "35 %" },
];

export default function BtpSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["btp-settings"],
    queryFn: () => fetchJSON(`${API}/btp/settings`),
  });

  const [form, setForm] = useState<Settings | null>(null);
  useEffect(() => { if (settings) setForm(settings); }, [settings]);

  const { data: holidays = [], isLoading: holidaysLoading } = useQuery<Holiday[]>({
    queryKey: ["btp-holidays"],
    queryFn: () => fetchJSON(`${API}/btp/holidays`),
  });

  const [holidayForm, setHolidayForm] = useState({ date: "", label: "", isRecurringYearly: true });
  const [holidayOpen, setHolidayOpen] = useState(false);

  const saveMut = useMutation({
    mutationFn: (body: any) => fetchJSON(`${API}/btp/settings`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["btp-settings"] });
      toast({ title: "Paramètres sauvegardés" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const addHolidayMut = useMutation({
    mutationFn: (body: any) => fetchJSON(`${API}/btp/holidays`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["btp-holidays"] });
      setHolidayOpen(false);
      setHolidayForm({ date: "", label: "", isRecurringYearly: true });
      toast({ title: "Jour férié ajouté" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  const delHolidayMut = useMutation({
    mutationFn: (id: string) => fetchJSON(`${API}/btp/holidays/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["btp-holidays"] });
      toast({ title: "Jour férié supprimé" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erreur", description: e.message }),
  });

  function f(key: keyof Settings) {
    return String((form as any)?.[key] ?? "");
  }
  function set(key: keyof Settings, val: any) {
    setForm((p) => p ? { ...p, [key]: val } : p);
  }

  if (isLoading || !form) {
    return (
      <HrShell title="Paramètres sectoriels" subtitle="Configuration de la paie — règles sectorielles">
        <div className="flex items-center gap-2 text-gray-400"><RefreshCw className="w-4 h-4 animate-spin" />Chargement…</div>
      </HrShell>
    );
  }

  return (
    <HrShell
      title="Paramètres sectoriels"
      subtitle="CNSS / IRPP / Majorations HS / Jours fériés"
      actions={
        <Button size="sm" onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending}>
          <Save className="w-4 h-4 mr-1" />
          {saveMut.isPending ? "Sauvegarde…" : "Sauvegarder"}
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-6 pb-8">
        {/* Durée légale & période */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-orange-500" />
              Temps de travail légal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FieldRow label="Heures / semaine" sub="Durée légale BTP Togo">
              <Input type="number" value={f("hoursPerWeek")} onChange={(e) => set("hoursPerWeek", e.target.value)} className="text-right h-8 text-sm" />
            </FieldRow>
            <FieldRow label="Heures / jour standard">
              <Input type="number" value={f("hoursPerDayStandard")} onChange={(e) => set("hoursPerDayStandard", e.target.value)} className="text-right h-8 text-sm" />
            </FieldRow>
            <FieldRow label="Diviseur TH" sub="40h×52÷12 = 173.33">
              <Input type="number" step="0.01" value={f("hourlyRateDivisor")} onChange={(e) => set("hourlyRateDivisor", e.target.value)} className="text-right h-8 text-sm" />
            </FieldRow>
            <FieldRow label="Début période" sub="Jour du mois">
              <Input type="number" min={1} max={31} value={f("periodStartDay")} onChange={(e) => set("periodStartDay", parseInt(e.target.value))} className="text-right h-8 text-sm" />
            </FieldRow>
            <FieldRow label="Fin période" sub="Jour du mois">
              <Input type="number" min={1} max={31} value={f("periodEndDay")} onChange={(e) => set("periodEndDay", parseInt(e.target.value))} className="text-right h-8 text-sm" />
            </FieldRow>
            <FieldRow label="Accrual congés" sub="Jours par mois">
              <Input type="number" step="0.01" value={f("leaveAccrualDaysPerMonth")} onChange={(e) => set("leaveAccrualDaysPerMonth", e.target.value)} className="text-right h-8 text-sm" />
            </FieldRow>
          </CardContent>
        </Card>

        {/* Taux de majoration HS */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-orange-500" />
              Majorations Heures Supplémentaires
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FieldRow label="HS 20%" sub="41e→48e heure / semaine">
              <PctInput value={f("hs20Rate")} onChange={(v) => set("hs20Rate", v)} />
            </FieldRow>
            <FieldRow label="HS 40%" sub="Au-delà de 48h/sem">
              <PctInput value={f("hs40Rate")} onChange={(v) => set("hs40Rate", v)} />
            </FieldRow>
            <FieldRow label="HS Dim/Fériés" sub="Configurable (défaut 65%)">
              <PctInput value={f("hsSundayRate")} onChange={(v) => set("hsSundayRate", v)} />
            </FieldRow>
            <FieldRow label="HS Nuit" sub="22h → 5h">
              <PctInput value={f("hsNightRate")} onChange={(v) => set("hsNightRate", v)} />
            </FieldRow>
            <FieldRow label="HS Nuit Dim/Fériés" sub="Cumul nuit + dim/fériés">
              <PctInput value={f("hsSundayNightRate")} onChange={(v) => set("hsSundayNightRate", v)} />
            </FieldRow>
          </CardContent>
        </Card>

        {/* CNSS */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-blue-500" />
              Cotisations CNSS (Togo)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FieldRow label="CNSS Salarié" sub="Part employé (vieillesse)">
              <PctInput value={f("cnssEmployeeRate")} onChange={(v) => set("cnssEmployeeRate", v)} />
            </FieldRow>
            <FieldRow label="CNSS Employeur" sub="Accidents + vieillesse + famille">
              <PctInput value={f("cnssEmployerRate")} onChange={(v) => set("cnssEmployerRate", v)} />
            </FieldRow>
          </CardContent>
        </Card>

        {/* IRPP */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-purple-500" />
              IRPP (CGI Togo)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FieldRow label="Abattement IRPP" sub="Frais professionnels (28%)">
              <PctInput value={f("irppAbatementRate")} onChange={(v) => set("irppAbatementRate", v)} />
            </FieldRow>
            <FieldRow label="Déduction / dépendant" sub="FCFA par charge">
              <Input type="number" step={1000} value={f("irppChargePerDependent")} onChange={(e) => set("irppChargePerDependent", e.target.value)} className="text-right h-8 text-sm" />
            </FieldRow>
            <FieldRow label="Max dépendants pris en compte">
              <Input type="number" min={0} max={10} value={f("irppMaxDependents")} onChange={(e) => set("irppMaxDependents", parseInt(e.target.value))} className="text-right h-8 text-sm" />
            </FieldRow>
            {/* Barème informatif */}
            <div className="mt-4">
              <div className="text-xs font-semibold text-gray-500 mb-2">Barème progressif mensuel (CGI)</div>
              <div className="space-y-0.5">
                {IRPP_BRACKETS.map((b, i) => (
                  <div key={i} className="flex justify-between text-[11px] text-gray-500">
                    <span>
                      {b.from.toLocaleString("fr-FR")} →{" "}
                      {b.to === Infinity ? "∞" : b.to.toLocaleString("fr-FR")} FCFA
                    </span>
                    <span className="font-semibold text-purple-600">{b.rate}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Jours fériés */}
        <Card className="col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-500" />
              Jours fériés (Togo)
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setHolidayOpen(true)}>
              <Plus className="w-4 h-4 mr-1" />Ajouter
            </Button>
          </CardHeader>
          <CardContent>
            {holidaysLoading ? (
              <div className="text-sm text-gray-400">Chargement…</div>
            ) : holidays.length === 0 ? (
              <div className="text-sm text-gray-400 py-4 text-center">
                Aucun jour férié configuré. Ajoutez les fêtes légales togolaises.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Libellé</TableHead>
                    <TableHead className="text-xs text-center">Récurrent</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holidays.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="text-xs font-mono">{h.date}</TableCell>
                      <TableCell className="text-xs">{h.label}</TableCell>
                      <TableCell className="text-xs text-center">
                        {h.isRecurringYearly
                          ? <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">Chaque année</Badge>
                          : <Badge variant="outline" className="text-[10px]">Ponctuel</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => delHolidayMut.mutate(h.id)}
                          className="text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {/* Jours fériés Togo pré-configurés */}
            <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div className="text-xs font-semibold text-amber-700 mb-2">Jours fériés légaux Togo (à saisir) :</div>
              <div className="grid grid-cols-3 gap-1 text-[11px] text-amber-600">
                {[
                  "1er janvier — Jour de l'An", "13 janvier — Fête nationale libération",
                  "27 avril — Fête nationale indépendance", "1er mai — Fête du travail",
                  "Lundi de Pâques", "Ascension", "Lundi de Pentecôte",
                  "15 août — Assomption", "1er novembre — Toussaint",
                  "25 décembre — Noël", "Aïd el-Fitr (variable)", "Aïd el-Adha (variable)",
                ].map((f) => <div key={f} className="flex items-center gap-1">• {f}</div>)}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog ajout jour férié */}
      <Dialog open={holidayOpen} onOpenChange={setHolidayOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajouter un jour férié</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={holidayForm.date}
                onChange={(e) => setHolidayForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <Label>Libellé</Label>
              <Input value={holidayForm.label}
                onChange={(e) => setHolidayForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Ex: Fête de l'Indépendance" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="recurring" checked={holidayForm.isRecurringYearly}
                onChange={(e) => setHolidayForm((f) => ({ ...f, isRecurringYearly: e.target.checked }))}
                className="w-4 h-4" />
              <Label htmlFor="recurring">Récurrent chaque année (même MM-JJ)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHolidayOpen(false)}>Annuler</Button>
            <Button
              onClick={() => addHolidayMut.mutate(holidayForm)}
              disabled={!holidayForm.date || !holidayForm.label || addHolidayMut.isPending}
            >
              {addHolidayMut.isPending ? "Ajout…" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </HrShell>
  );
}
