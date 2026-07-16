import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { formatFCFA } from "@/lib/format";
import { AccountingShell } from "./_layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, Wand2, CheckCircle2, AlertCircle, Clock, ArrowRight,
  Link2, Unlink, EyeOff, RefreshCw, ChevronDown, ChevronRight,
  ArrowDownCircle, ArrowUpCircle, Landmark, Wifi,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
type BankAcc = {
  id: string; name: string; type: string; bankName?: string; accountNumber?: string;
  currency?: string; openingBalance: number; computedBalance: number;
  accountCode?: string; accountLabel?: string;
};
type BankTx = {
  id: string; transactionDate: string; label: string; amount: number;
  reference?: string; isReconciled: boolean; reconciledLineId?: string;
};
type JELine = {
  lineId: string; entryNumber: string; entryDate: string; description: string;
  debit: number; credit: number;
};
type Suggestion = {
  transaction: { id: string; transactionDate: string; label: string; amount: number; reference?: string };
  candidates: Array<{ lineId: string; entryNumber: string; entryDate: string; description: string; debit: number; credit: number; net: number; score: number }>;
  bestMatch: { lineId: string; entryNumber: string; entryDate: string; description: string; score: number } | null;
  confidence: number;
};
type AutoMatchResult = { suggestions: Suggestion[]; stats: { total: number; highConfidence: number; medium: number; unmatched: number } };

// ─── CSV parser (côté frontend, aucune dépendance) ────────────────────────────
function parseCSV(text: string): Array<{ date: string; label: string; amount: number; reference?: string }> {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase().replace(/["']/g, ""));

  const findCol = (names: string[]) => headers.findIndex((h) => names.some((n) => h.includes(n)));
  const dateIdx   = findCol(["date"]);
  const labelIdx  = findCol(["libellé", "libelle", "label", "description", "motif", "opération", "operation"]);
  const amountIdx = findCol(["montant", "amount", "solde"]);
  const debitIdx  = findCol(["débit", "debit", "sortie"]);
  const creditIdx = findCol(["crédit", "credit", "entrée"]);
  const refIdx    = findCol(["référence", "reference", "ref", "numéro", "numero"]);

  return lines.slice(1).map((line) => {
    const cols = line.split(sep).map((c) => c.trim().replace(/^["']|["']$/g, ""));
    const rawDate   = dateIdx >= 0 ? cols[dateIdx] : "";
    const rawLabel  = labelIdx >= 0 ? cols[labelIdx] : `Opération importée`;
    const rawRef    = refIdx >= 0 ? cols[refIdx] : undefined;
    let amount = 0;
    if (amountIdx >= 0) {
      amount = parseFloat(cols[amountIdx].replace(/\s/g, "").replace(",", ".")) || 0;
    } else if (debitIdx >= 0 || creditIdx >= 0) {
      const d = debitIdx  >= 0 ? parseFloat(cols[debitIdx].replace(/\s/g, "").replace(",", "."))  || 0 : 0;
      const c = creditIdx >= 0 ? parseFloat(cols[creditIdx].replace(/\s/g, "").replace(",", ".")) || 0 : 0;
      amount = c - d; // crédit positif, débit négatif
    }
    // Normalise date DD/MM/YYYY → YYYY-MM-DD
    let date = rawDate;
    const m = rawDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) date = `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;

    return { date, label: rawLabel, amount, reference: rawRef };
  }).filter((r) => r.date && r.amount !== 0);
}

// ─── Composant badge confiance ─────────────────────────────────────────────────
function ConfidenceBadge({ score }: { score: number }) {
  if (score >= 70) return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[11px]"><CheckCircle2 className="w-3 h-3 mr-1" />Haute ({score}%)</Badge>;
  if (score >= 40) return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[11px]"><Clock className="w-3 h-3 mr-1" />Moyenne ({score}%)</Badge>;
  return <Badge className="bg-red-50 text-red-600 border-red-200 text-[11px]"><AlertCircle className="w-3 h-3 mr-1" />Faible ({score}%)</Badge>;
}

// ─── Page principale ───────────────────────────────────────────────────────────
export default function ReconciliationPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [tab, setTab]     = useState<"pending" | "reconciled">("pending");
  const [selectedTx, setSelectedTx]   = useState<string | null>(null);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [showImport, setShowImport]   = useState(false);
  const [csvText, setCsvText]         = useState("");
  const [parsedLines, setParsedLines] = useState<ReturnType<typeof parseCSV>>([]);
  const [showAutoResult, setShowAutoResult] = useState(false);

  // ── Queries ──
  const { data: banksData } = useQuery<{ data: BankAcc[] }>({
    queryKey: ["bank-accounts"],
    queryFn: () => apiFetch("/api/accounting/bank-accounts"),
  });
  const banks = banksData?.data ?? [];

  const { data: recon, isLoading: reconLoading } = useQuery<{ bank: BankAcc; transactions: BankTx[]; journalLines: JELine[] }>({
    queryKey: ["recon", selectedBank],
    queryFn: () => apiFetch(`/api/accounting/bank-accounts/${selectedBank}/reconciliation`),
    enabled: !!selectedBank,
  });

  const { data: allTx } = useQuery<{ data: BankTx[] }>({
    queryKey: ["bank-tx", selectedBank],
    queryFn: () => apiFetch(`/api/accounting/bank-accounts/${selectedBank}/transactions`),
    enabled: !!selectedBank,
  });

  const { data: autoData, refetch: runAutoMatch, isFetching: autoLoading } = useQuery<AutoMatchResult>({
    queryKey: ["auto-match", selectedBank],
    queryFn: () => apiFetch(`/api/accounting/bank-accounts/${selectedBank}/auto-match`),
    enabled: false,
  });

  // ── Mutations ──
  const importMut = useMutation({
    mutationFn: (lines: ReturnType<typeof parseCSV>) =>
      apiFetch(`/api/accounting/bank-accounts/${selectedBank}/transactions/bulk`, {
        method: "POST", body: JSON.stringify({ lines }),
      }),
    onSuccess: (d: any) => {
      toast({ title: `${d.imported} ligne(s) importée(s)` });
      setShowImport(false); setCsvText(""); setParsedLines([]);
      qc.invalidateQueries({ queryKey: ["bank-tx", selectedBank] });
      qc.invalidateQueries({ queryKey: ["recon", selectedBank] });
    },
  });

  const applyAutoMut = useMutation({
    mutationFn: () => apiFetch(`/api/accounting/bank-accounts/${selectedBank}/auto-match/apply`, { method: "POST" }),
    onSuccess: (d: any) => {
      toast({ title: `${d.applied} rapprochement(s) automatique(s) appliqué(s)` });
      setShowAutoResult(false);
      qc.invalidateQueries({ queryKey: ["recon", selectedBank] });
      qc.invalidateQueries({ queryKey: ["bank-tx", selectedBank] });
      qc.invalidateQueries({ queryKey: ["auto-match", selectedBank] });
    },
  });

  const matchMut = useMutation({
    mutationFn: ({ transactionId, lineId }: { transactionId: string; lineId: string }) =>
      apiFetch("/api/accounting/reconciliation/match", { method: "POST", body: JSON.stringify({ transactionId, lineId }) }),
    onSuccess: () => {
      toast({ title: "Transaction rapprochée" });
      setSelectedTx(null); setSelectedLine(null);
      qc.invalidateQueries({ queryKey: ["recon", selectedBank] });
      qc.invalidateQueries({ queryKey: ["bank-tx", selectedBank] });
    },
  });

  const unmatchMut = useMutation({
    mutationFn: (transactionId: string) =>
      apiFetch("/api/accounting/reconciliation/unmatch", { method: "POST", body: JSON.stringify({ transactionId }) }),
    onSuccess: () => {
      toast({ title: "Rapprochement annulé" });
      qc.invalidateQueries({ queryKey: ["recon", selectedBank] });
      qc.invalidateQueries({ queryKey: ["bank-tx", selectedBank] });
    },
  });

  const ignoreMut = useMutation({
    mutationFn: (transactionId: string) =>
      apiFetch("/api/accounting/reconciliation/ignore", { method: "POST", body: JSON.stringify({ transactionId }) }),
    onSuccess: () => {
      toast({ title: "Transaction ignorée" });
      qc.invalidateQueries({ queryKey: ["recon", selectedBank] });
      qc.invalidateQueries({ queryKey: ["bank-tx", selectedBank] });
    },
  });

  // ── Données dérivées ──
  const selectedBankObj = banks.find((b) => b.id === selectedBank);
  const pendingTxs      = recon?.transactions ?? [];
  const journalLines    = recon?.journalLines ?? [];
  const reconciledTxs   = (allTx?.data ?? []).filter((t) => t.isReconciled);
  const totalTx         = (allTx?.data ?? []).length;
  const reconciledCount = reconciledTxs.length;
  const reconRate       = totalTx > 0 ? Math.round((reconciledCount / totalTx) * 100) : 0;

  const activeSuggestion = autoData?.suggestions.find((s) => s.transaction.id === selectedTx);
  const candidateLineIds = new Set(activeSuggestion?.candidates.map((c) => c.lineId) ?? []);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { const t = ev.target?.result as string; setCsvText(t); setParsedLines(parseCSV(t)); };
    reader.readAsText(file);
  };

  const handleParseCSV = () => { const pl = parseCSV(csvText); setParsedLines(pl); };

  return (
    <AccountingShell
      title="Rapprochement bancaire"
      subtitle="Importez vos relevés et rapprochez automatiquement vos écritures comptables"
    >
      <div className="space-y-5">

        {/* ── Sélecteur de comptes bancaires ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {banks.map((b) => (
            <button
              key={b.id}
              onClick={() => { setSelectedBank(b.id); setSelectedTx(null); setSelectedLine(null); setShowAutoResult(false); }}
              className={cn(
                "text-left p-4 rounded-xl border transition-all duration-150",
                selectedBank === b.id
                  ? "border-amber-400 bg-amber-50 shadow-sm"
                  : "border-border/70 bg-card hover:border-amber-300 hover:bg-amber-50/40"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <Landmark className={cn("w-4 h-4 mt-0.5 shrink-0", selectedBank === b.id ? "text-amber-600" : "text-muted-foreground")} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{b.name}</p>
                  {b.bankName && <p className="text-[11px] text-muted-foreground">{b.bankName}</p>}
                </div>
              </div>
              <p className={cn("text-lg font-bold mt-2", b.computedBalance >= 0 ? "text-emerald-600" : "text-red-500")}>
                {formatFCFA(b.computedBalance)}
              </p>
            </button>
          ))}
          {banks.length === 0 && (
            <div className="col-span-full py-8 text-center text-muted-foreground text-sm">
              Aucun compte bancaire configuré. Créez-en un dans l'onglet <strong>Banques</strong>.
            </div>
          )}
        </div>

        {selectedBank && (
          <>
            {/* ── KPI bar ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total mouvements", value: totalTx, color: "text-foreground" },
                { label: "Rapprochés", value: reconciledCount, color: "text-emerald-600" },
                { label: "À rapprocher", value: pendingTxs.length, color: "text-amber-600" },
                { label: "Taux de rapprochement", value: `${reconRate}%`, color: reconRate >= 80 ? "text-emerald-600" : "text-amber-600" },
              ].map((k) => (
                <Card key={k.label} className="shadow-none border-border/60">
                  <CardContent className="p-4">
                    <p className="text-[11px] font-medium text-muted-foreground mb-1">{k.label}</p>
                    <p className={cn("text-2xl font-bold font-display", k.color)}>{k.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* ── Barre d'actions ── */}
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => { setShowImport((v) => !v); setShowAutoResult(false); }}>
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                Importer relevé CSV/XLSX
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={async () => { await runAutoMatch(); setShowAutoResult(true); setShowImport(false); }}
                disabled={autoLoading || pendingTxs.length === 0}
              >
                <Wand2 className="w-3.5 h-3.5 mr-1.5" />
                {autoLoading ? "Analyse…" : "Analyse automatique"}
              </Button>
              {autoData && showAutoResult && autoData.stats.highConfidence > 0 && (
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => applyAutoMut.mutate()}
                  disabled={applyAutoMut.isPending}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  Appliquer {autoData.stats.highConfidence} correspondance(s) automatique(s)
                </Button>
              )}
              <Button
                variant="ghost" size="sm"
                onClick={() => { qc.invalidateQueries({ queryKey: ["recon", selectedBank] }); qc.invalidateQueries({ queryKey: ["bank-tx", selectedBank] }); }}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* ── Import CSV ── */}
            {showImport && (
              <Card className="border-amber-200 bg-amber-50/30">
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-sm font-semibold">Import de relevé bancaire</CardTitle>
                  <p className="text-[12px] text-muted-foreground">
                    Collez le contenu CSV de votre relevé ou uploadez un fichier. Colonnes reconnues : Date, Libellé, Montant (ou Débit / Crédit séparés), Référence.
                  </p>
                </CardHeader>
                <CardContent className="px-5 pb-5 space-y-3">
                  <div className="flex gap-2">
                    <input ref={fileRef} type="file" accept=".csv,.txt,.tsv,.xlsx,.xls" className="hidden" onChange={handleFile} />
                    <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                      <Upload className="w-3.5 h-3.5 mr-1.5" />Choisir un fichier
                    </Button>
                    {csvText && <Button variant="ghost" size="sm" onClick={handleParseCSV}>Analyser</Button>}
                  </div>
                  <textarea
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    onBlur={handleParseCSV}
                    placeholder={`Date;Libellé;Débit;Crédit;Référence\n15/01/2026;Paiement fournisseur BTP;450000;;F2026-001\n20/01/2026;Encaissement client SOGELEC;;1200000;F2026-015`}
                    rows={5}
                    className="w-full rounded-lg border border-input bg-card text-xs font-mono px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                  />
                  {parsedLines.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[12px] font-medium text-emerald-700">{parsedLines.length} ligne(s) détectée(s) — aperçu :</p>
                      <div className="max-h-40 overflow-y-auto rounded-lg border border-border/60 bg-card">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/40"><tr>{["Date","Libellé","Montant","Réf"].map((h) => <th key={h} className="px-3 py-1.5 text-left font-semibold text-muted-foreground">{h}</th>)}</tr></thead>
                          <tbody className="divide-y divide-border/40">
                            {parsedLines.slice(0, 10).map((l, i) => (
                              <tr key={i}>
                                <td className="px-3 py-1">{l.date}</td>
                                <td className="px-3 py-1 max-w-[200px] truncate">{l.label}</td>
                                <td className={cn("px-3 py-1 font-mono tabular-nums", l.amount >= 0 ? "text-emerald-600" : "text-red-500")}>{formatFCFA(l.amount)}</td>
                                <td className="px-3 py-1 text-muted-foreground">{l.reference ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => importMut.mutate(parsedLines)} disabled={importMut.isPending}>
                          {importMut.isPending ? "Import…" : `Importer ${parsedLines.length} ligne(s)`}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { setCsvText(""); setParsedLines([]); setShowImport(false); }}>Annuler</Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── Résultat auto-match ── */}
            {showAutoResult && autoData && (
              <Card className="border-blue-200 bg-blue-50/20">
                <CardHeader className="pb-2 pt-4 px-5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Wand2 className="w-4 h-4 text-blue-600" />
                      Analyse automatique — {autoData.stats.total} transaction(s)
                    </CardTitle>
                    <button onClick={() => setShowAutoResult(false)} className="text-muted-foreground hover:text-foreground text-xs">Fermer</button>
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-4">
                  <div className="flex flex-wrap gap-3 text-sm mb-3">
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /><strong>{autoData.stats.highConfidence}</strong> haute confiance</span>
                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-amber-500" /><strong>{autoData.stats.medium}</strong> moyenne</span>
                    <span className="flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5 text-red-400" /><strong>{autoData.stats.unmatched}</strong> sans correspondance</span>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {autoData.suggestions.map((s) => (
                      <div
                        key={s.transaction.id}
                        className={cn(
                          "flex items-center gap-3 p-2.5 rounded-lg border text-sm cursor-pointer transition-colors",
                          selectedTx === s.transaction.id ? "border-amber-400 bg-amber-50" : "border-border/60 bg-card hover:bg-muted/30"
                        )}
                        onClick={() => setSelectedTx(selectedTx === s.transaction.id ? null : s.transaction.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{s.transaction.label}</p>
                          <p className="text-[11px] text-muted-foreground">{s.transaction.transactionDate} · {formatFCFA(s.transaction.amount)}</p>
                        </div>
                        {s.bestMatch ? (
                          <div className="text-right min-w-0 shrink-0">
                            <ConfidenceBadge score={s.confidence} />
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[160px]">{s.bestMatch.entryNumber}</p>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-[11px] shrink-0">Aucune correspondance</Badge>
                        )}
                        {selectedTx === s.transaction.id ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Tabs ── */}
            <div className="flex gap-1 border-b border-border/60">
              {([["pending", `À rapprocher (${pendingTxs.length})`], ["reconciled", `Rapprochés (${reconciledCount})`]] as const).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={cn(
                    "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                    tab === k ? "border-amber-500 text-amber-700" : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >{label}</button>
              ))}
            </div>

            {/* ── Tab: À rapprocher ── */}
            {tab === "pending" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Panel gauche — Mouvements bancaires */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">Relevé bancaire</h3>
                    <span className="text-[11px] text-muted-foreground">{pendingTxs.length} mouvement(s)</span>
                  </div>
                  {reconLoading && <div className="py-8 text-center text-muted-foreground text-sm">Chargement…</div>}
                  {!reconLoading && pendingTxs.length === 0 && (
                    <div className="py-10 text-center text-sm text-muted-foreground border border-dashed border-border/60 rounded-xl">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                      Tous les mouvements sont rapprochés !
                    </div>
                  )}
                  <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
                    {pendingTxs.map((tx) => {
                      const isSelected = selectedTx === tx.id;
                      const suggestion = autoData?.suggestions.find((s) => s.transaction.id === tx.id);
                      const hasGoodMatch = suggestion && suggestion.confidence >= 60;
                      return (
                        <div
                          key={tx.id}
                          onClick={() => { setSelectedTx(isSelected ? null : tx.id); setSelectedLine(null); }}
                          className={cn(
                            "p-3 rounded-xl border cursor-pointer transition-all duration-150 group",
                            isSelected
                              ? "border-amber-400 bg-amber-50 shadow-sm"
                              : hasGoodMatch
                              ? "border-emerald-200 bg-emerald-50/40 hover:border-emerald-300"
                              : "border-border/60 bg-card hover:border-border"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 min-w-0">
                              {tx.amount >= 0
                                ? <ArrowDownCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                                : <ArrowUpCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                              }
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{tx.label}</p>
                                <p className="text-[11px] text-muted-foreground">{tx.transactionDate}{tx.reference ? ` · ${tx.reference}` : ""}</p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={cn("text-sm font-bold tabular-nums", tx.amount >= 0 ? "text-emerald-600" : "text-red-500")}>{formatFCFA(tx.amount)}</p>
                              {suggestion && <ConfidenceBadge score={suggestion.confidence} />}
                            </div>
                          </div>
                          {isSelected && suggestion && suggestion.candidates.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-amber-200 space-y-1">
                              <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">Correspondances suggérées</p>
                              {suggestion.candidates.slice(0, 3).map((c) => (
                                <div
                                  key={c.lineId}
                                  onClick={(e) => { e.stopPropagation(); setSelectedLine(c.lineId); }}
                                  className={cn("flex items-center justify-between px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors",
                                    selectedLine === c.lineId ? "bg-amber-200 font-medium" : "hover:bg-amber-100")}
                                >
                                  <span className="truncate">{c.entryNumber} — {c.description || c.entryDate}</span>
                                  <div className="flex items-center gap-2 shrink-0 ml-2">
                                    <span className={cn("tabular-nums", c.net >= 0 ? "text-emerald-600" : "text-red-500")}>{formatFCFA(c.net)}</span>
                                    <Badge className={cn("text-[10px]", c.score >= 60 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>{c.score}%</Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {isSelected && (
                            <div className="mt-2 flex gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-primary hover:bg-primary text-white"
                                disabled={!selectedLine || matchMut.isPending}
                                onClick={() => selectedLine && matchMut.mutate({ transactionId: tx.id, lineId: selectedLine })}
                              >
                                <Link2 className="w-3 h-3 mr-1" />Rapprocher
                              </Button>
                              {suggestion?.bestMatch && (
                                <Button
                                  size="sm" variant="outline"
                                  className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                  disabled={matchMut.isPending}
                                  onClick={() => suggestion.bestMatch && matchMut.mutate({ transactionId: tx.id, lineId: suggestion.bestMatch!.lineId })}
                                >
                                  <Wand2 className="w-3 h-3 mr-1" />Appliquer suggestion
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
                                onClick={() => ignoreMut.mutate(tx.id)} disabled={ignoreMut.isPending}>
                                <EyeOff className="w-3 h-3 mr-1" />Ignorer
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Panel droit — Écritures comptables disponibles */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">Écritures comptables non rapprochées</h3>
                    <span className="text-[11px] text-muted-foreground">{journalLines.length} ligne(s)</span>
                  </div>
                  {journalLines.length === 0 && (
                    <div className="py-10 text-center text-sm text-muted-foreground border border-dashed border-border/60 rounded-xl">
                      Aucune écriture disponible sur ce compte.
                    </div>
                  )}
                  <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
                    {journalLines.map((jl) => {
                      const isHighlighted = candidateLineIds.has(jl.lineId);
                      const isChosen      = selectedLine === jl.lineId;
                      const net           = jl.debit - jl.credit;
                      const thisCand      = activeSuggestion?.candidates.find((c) => c.lineId === jl.lineId);
                      return (
                        <div
                          key={jl.lineId}
                          onClick={() => setSelectedLine(isChosen ? null : jl.lineId)}
                          className={cn(
                            "p-3 rounded-xl border cursor-pointer transition-all duration-150",
                            isChosen      ? "border-amber-400 bg-amber-50 shadow-sm" :
                            isHighlighted ? "border-blue-300 bg-blue-50/40 hover:border-blue-400" :
                                            "border-border/60 bg-card hover:border-border"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{jl.entryNumber}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{jl.entryDate} · {jl.description || "—"}</p>
                            </div>
                            <div className="text-right shrink-0 space-y-1">
                              <p className={cn("text-sm font-bold tabular-nums", net >= 0 ? "text-emerald-600" : "text-red-500")}>{formatFCFA(net)}</p>
                              {thisCand && <ConfidenceBadge score={thisCand.score} />}
                              {isHighlighted && !thisCand && <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]">Suggérée</Badge>}
                            </div>
                          </div>
                          {jl.debit > 0 && jl.credit > 0 && (
                            <div className="mt-1 flex gap-3 text-[11px] text-muted-foreground">
                              <span>Débit: {formatFCFA(jl.debit)}</span>
                              <span>Crédit: {formatFCFA(jl.credit)}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

            {/* ── Tab: Rapprochés ── */}
            {tab === "reconciled" && (
              <div className="space-y-2">
                {reconciledTxs.length === 0 && (
                  <div className="py-10 text-center text-sm text-muted-foreground">Aucune transaction rapprochée.</div>
                )}
                {reconciledTxs.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl border border-emerald-100 bg-emerald-50/30">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tx.label}</p>
                      <p className="text-[11px] text-muted-foreground">{tx.transactionDate}</p>
                    </div>
                    <p className={cn("text-sm font-bold tabular-nums shrink-0", tx.amount >= 0 ? "text-emerald-600" : "text-red-500")}>{formatFCFA(tx.amount)}</p>
                    <Button
                      variant="ghost" size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-red-500 shrink-0"
                      onClick={() => unmatchMut.mutate(tx.id)}
                      disabled={unmatchMut.isPending}
                    >
                      <Unlink className="w-3 h-3 mr-1" />Annuler
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* ── Bank feeds — section préparation ── */}
            <Card className="border-dashed border-border/60 bg-muted/20">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                  <Wifi className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Bank feeds — Synchronisation automatique</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    Connexion directe à votre banque via les API Open Banking (Bridge, Plaid, Finom…).
                    L'architecture est prête — connectez votre établissement pour importer les mouvements automatiquement sans upload manuel.
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 text-[11px]">Bientôt disponible</Badge>
              </CardContent>
            </Card>

          </>
        )}
      </div>
    </AccountingShell>
  );
}
