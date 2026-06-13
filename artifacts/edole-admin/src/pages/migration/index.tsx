import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  Upload, Download, CheckCircle2, AlertTriangle, XCircle, ArrowLeft,
  ArrowRight, Database, FileSpreadsheet, ClipboardCheck, Loader2,
  Building2, Users, UserCheck, FileText, CreditCard, BookOpen,
  Briefcase, Wrench, History, RefreshCw, Info, ChevronRight,
} from "lucide-react";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FieldDef {
  key: string; label: string; required: boolean; type: string;
  examples: string; aliases: string[]; acceptedValues?: string[];
}

interface ModuleInfo {
  id: string; label: string; icon: string; description: string; category: string;
  fields: number; requiredFields: number;
  lastImport: { status: string; importedRows: number; createdAt: string } | null;
}

interface ModulesResponse {
  modules: ModuleInfo[];
  progress: { total: number; completed: number; pct: number };
}

interface UploadResponse {
  fileId: string; fileName: string; headers: string[]; rowCount: number;
  preview: Record<string, string>[];
  suggestedMapping: Record<string, string>;
  module: { id: string; label: string; fields: FieldDef[] };
}

interface ValidationResponse {
  totalRows: number; validRows: number; errorRows: number;
  errors: Array<{ row: number; field: string; message: string; severity: string }>;
  errorCount: number; warningCount: number;
  unmappedRequired: string[];
  canImport: boolean;
}

interface ImportResponse {
  sessionId: string; status: string;
  imported: number; skipped: number;
  errors: Array<{ row: number; message: string }>;
}

interface Session {
  id: string; module: string; fileName?: string; status: string;
  totalRows?: number; importedRows?: number; errorRows?: number;
  createdAt: string; completedAt?: string;
}

// ── Icon map ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICONS: Record<string, React.ComponentType<any>> = {
  Building2, Users, UserCheck, FileText, CreditCard, BookOpen, Briefcase, Wrench,
};

const CAT_COLORS: Record<string, string> = {
  CRM: "bg-blue-100 text-blue-700", RH: "bg-purple-100 text-purple-700",
  Ventes: "bg-emerald-100 text-emerald-700", Comptabilité: "bg-amber-100 text-amber-700",
  Opérations: "bg-orange-100 text-orange-700",
};

// ── Step enum ────────────────────────────────────────────────────────────────

type WizardStep = "modules" | "upload" | "mapping" | "validate" | "execute" | "done";

// ── Helpers ───────────────────────────────────────────────────────────────────

function downloadAuthed(url: string, filename: string) {
  const token = localStorage.getItem("auth_token");
  fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    .then(r => r.blob())
    .then(b => { const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = filename; a.click(); });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    done:      { label: "Importé",    cls: "bg-emerald-100 text-emerald-700" },
    error:     { label: "Erreur",     cls: "bg-red-100 text-red-700" },
    importing: { label: "En cours",   cls: "bg-blue-100 text-blue-700" },
    pending:   { label: "En attente", cls: "bg-slate-100 text-slate-600" },
  };
  const s = map[status] ?? { label: status, cls: "bg-slate-100 text-slate-500" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${s.cls}`}>{s.label}</span>;
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function MigrationPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"wizard" | "history">("wizard");
  const [step, setStep] = useState<WizardStep>("modules");
  const [selectedModule, setSelectedModule] = useState<ModuleInfo | null>(null);
  const [uploadData, setUploadData] = useState<UploadResponse | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [validationResult, setValidationResult] = useState<ValidationResponse | null>(null);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const [saveMappingName, setSaveMappingName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: modulesData, isLoading: loadingModules } = useQuery<ModulesResponse>({
    queryKey: ["migration-modules"],
    queryFn: () => apiFetch("/api/migration/modules"),
  });

  const { data: sessionsData, isLoading: loadingSessions } = useQuery<{ sessions: Session[] }>({
    queryKey: ["migration-sessions"],
    queryFn: () => apiFetch("/api/migration/sessions"),
    enabled: tab === "history",
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedModule) throw new Error("Module non sélectionné");
      const fd = new FormData();
      fd.append("file", file);
      fd.append("module", selectedModule.id);
      const token = localStorage.getItem("auth_token");
      const r = await fetch("/api/migration/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json() as Promise<UploadResponse>;
    },
    onSuccess: (data) => {
      setUploadData(data);
      setMapping(data.suggestedMapping);
      setStep("mapping");
      toast.success(`${data.rowCount} ligne(s) détectée(s) dans "${data.fileName}"`);
    },
    onError: (e) => toast.error(`Erreur upload : ${(e as Error).message}`),
  });

  // Validate mutation
  const validateMutation = useMutation({
    mutationFn: () => apiFetch("/api/migration/validate", {
      method: "POST",
      body: JSON.stringify({ fileId: uploadData!.fileId, mapping }),
    }) as Promise<ValidationResponse>,
    onSuccess: (data) => { setValidationResult(data); setStep("validate"); },
    onError: (e) => toast.error(`Erreur validation : ${(e as Error).message}`),
  });

  // Execute mutation
  const executeMutation = useMutation({
    mutationFn: () => apiFetch("/api/migration/execute", {
      method: "POST",
      body: JSON.stringify({ fileId: uploadData!.fileId, mapping, saveMappingName: saveMappingName || undefined }),
    }) as Promise<ImportResponse>,
    onSuccess: (data) => {
      setImportResult(data);
      setStep("done");
      qc.invalidateQueries({ queryKey: ["migration-modules"] });
      qc.invalidateQueries({ queryKey: ["migration-sessions"] });
      toast.success(`Import terminé : ${data.imported} ligne(s) importée(s)`);
    },
    onError: (e) => toast.error(`Erreur import : ${(e as Error).message}`),
  });

  const handleFile = useCallback((file: File) => { uploadMutation.mutate(file); }, [uploadMutation]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const resetWizard = () => {
    setStep("modules"); setSelectedModule(null); setUploadData(null);
    setMapping({}); setValidationResult(null); setImportResult(null); setSaveMappingName("");
  };

  // ── Breadcrumb steps ──────────────────────────────────────────────────────

  const STEPS: Array<{ id: WizardStep; label: string }> = [
    { id: "modules", label: "Module" },
    { id: "upload",  label: "Fichier" },
    { id: "mapping", label: "Mapping" },
    { id: "validate", label: "Validation" },
    { id: "execute", label: "Import" },
    { id: "done",    label: "Terminé" },
  ];

  const stepIndex = STEPS.findIndex(s => s.id === step);

  return (
    <div className="space-y-4 pb-10">
      <PageHeader
        title="Migration & Import des données"
        subtitle="Importez vos données existantes dans Gaméasù étape par étape"
        icon={Database}
      />

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <Tabs value={tab} onValueChange={v => setTab(v as "wizard" | "history")}>
        <TabsList>
          <TabsTrigger value="wizard"><Upload className="w-3.5 h-3.5 mr-1.5" />Assistant d'import</TabsTrigger>
          <TabsTrigger value="history"><History className="w-3.5 h-3.5 mr-1.5" />Historique</TabsTrigger>
        </TabsList>

        {/* ── WIZARD ──────────────────────────────────────────────────────── */}
        <TabsContent value="wizard" className="space-y-4 pt-2">

          {/* Progress bar */}
          {step !== "modules" && (
            <div className="flex items-center gap-2 px-1">
              <button onClick={resetWizard} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Recommencer
              </button>
              <div className="flex items-center gap-1 flex-1 overflow-x-auto">
                {STEPS.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-1 shrink-0">
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold
                      ${i < stepIndex ? "bg-emerald-100 text-emerald-700" : i === stepIndex ? "bg-primary text-white" : "bg-slate-100 text-slate-400"}`}>
                      {i < stepIndex && <CheckCircle2 className="w-3 h-3" />}
                      {s.label}
                    </div>
                    {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 1 : Module selection ──────────────────────────────────── */}
          {step === "modules" && (
            <div className="space-y-4">
              {/* Global progress */}
              {modulesData && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold">Progression globale de la migration</span>
                      <span className="text-sm font-bold text-primary">{modulesData.progress.pct}%</span>
                    </div>
                    <Progress value={modulesData.progress.pct} className="h-2" />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {modulesData.progress.completed} / {modulesData.progress.total} modules importés
                    </p>
                  </CardContent>
                </Card>
              )}

              {loadingModules && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}

              {/* Module grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {modulesData?.modules.map(mod => {
                  const Icon = ICONS[mod.icon] ?? Database;
                  const done = mod.lastImport?.status === "done";
                  return (
                    <Card key={mod.id} className={`cursor-pointer transition-all hover:shadow-md border-2 ${done ? "border-emerald-200" : "border-transparent hover:border-primary/30"}`}
                      onClick={() => { setSelectedModule(mod); setStep("upload"); }}>
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-start justify-between">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${done ? "bg-emerald-100" : "bg-slate-100"}`}>
                            <Icon className={`w-5 h-5 ${done ? "text-emerald-600" : "text-slate-600"}`} />
                          </div>
                          {done && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                        </div>
                        <div>
                          <p className="font-semibold text-sm leading-tight">{mod.label}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{mod.description}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${CAT_COLORS[mod.category] ?? "bg-slate-100 text-slate-600"}`}>
                            {mod.category}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{mod.fields} champs</span>
                        </div>
                        {mod.lastImport && (
                          <div className="text-[10px] text-muted-foreground border-t pt-1.5">
                            Dernier import : <span className="font-semibold">{mod.lastImport.importedRows} lignes</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Template downloads */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    Télécharger les templates Excel
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-3">
                    Chaque template contient : feuille Données à remplir · feuille Instructions · exemples · validation des valeurs acceptées.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {modulesData?.modules.map(mod => (
                      <Button key={mod.id} variant="outline" size="sm" className="text-xs gap-1.5 h-7"
                        onClick={() => downloadAuthed(`/api/migration/templates/${mod.id}`, `template-${mod.id}.xlsx`)}>
                        <Download className="w-3 h-3" /> {mod.label}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── STEP 2 : Upload ─────────────────────────────────────────────── */}
          {step === "upload" && selectedModule && (
            <div className="space-y-4 max-w-2xl mx-auto">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="w-4 h-4 text-primary" />
                    Importer les données — {selectedModule.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3 bg-blue-50 rounded-lg p-3">
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-blue-800 space-y-0.5">
                      <p className="font-semibold">Avant d'importer :</p>
                      <p>• Téléchargez le template si ce n'est pas encore fait</p>
                      <p>• Remplissez les colonnes — les champs marqués * sont obligatoires</p>
                      <p>• Supprimez la ligne d'exemple (ligne 4) avant l'import</p>
                      <p>• Enregistrez en format <strong>.xlsx</strong> ou <strong>.csv</strong></p>
                    </div>
                  </div>

                  <Button variant="outline" size="sm" className="gap-2 w-full justify-center"
                    onClick={() => downloadAuthed(`/api/migration/templates/${selectedModule.id}`, `template-${selectedModule.id}.xlsx`)}>
                    <Download className="w-4 h-4 text-emerald-600" />
                    Télécharger le template {selectedModule.label}
                  </Button>

                  {/* Drop zone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
                      ${isDragging ? "border-primary bg-primary/5" : "border-slate-200 hover:border-primary/50 hover:bg-slate-50"}
                      ${uploadMutation.isPending ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    {uploadMutation.isPending ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Analyse du fichier en cours…</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                          <Upload className="w-6 h-6 text-slate-400" />
                        </div>
                        <p className="font-semibold text-sm">Glisser-déposer votre fichier ici</p>
                        <p className="text-xs text-muted-foreground">ou cliquer pour parcourir</p>
                        <p className="text-[11px] text-slate-400">.xlsx, .xls, .csv — max 10 Mo</p>
                      </div>
                    )}
                    <input ref={fileRef} type="file" className="hidden" accept=".xlsx,.xls,.csv"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── STEP 3 : Column mapping ──────────────────────────────────────── */}
          {step === "mapping" && uploadData && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <ClipboardCheck className="w-4 h-4 text-primary" />
                    Mapping des colonnes — {uploadData.module.label}
                    <Badge variant="outline" className="ml-auto text-xs">{uploadData.rowCount} ligne(s) détectée(s)</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Associez chaque colonne de votre fichier au champ Gaméasù correspondant.
                    Le système a pré-rempli les correspondances détectées automatiquement.
                  </p>

                  {/* Mapping table */}
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs w-[40%]">Colonne dans votre fichier</TableHead>
                          <TableHead className="text-xs w-[40%]">Champ Gaméasù</TableHead>
                          <TableHead className="text-xs w-[20%]">Aperçu</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {uploadData.headers.map(header => (
                          <TableRow key={header}>
                            <TableCell className="text-xs font-mono py-1.5">{header}</TableCell>
                            <TableCell className="py-1.5">
                              <Select
                                value={mapping[header] ?? "__skip__"}
                                onValueChange={v => {
                                  const newMap = { ...mapping };
                                  if (v === "__skip__") delete newMap[header];
                                  else newMap[header] = v;
                                  setMapping(newMap);
                                }}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue placeholder="— Ignorer —" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__skip__" className="text-xs text-muted-foreground">— Ignorer cette colonne —</SelectItem>
                                  {uploadData.module.fields.map(f => (
                                    <SelectItem key={f.key} value={f.key} className="text-xs">
                                      {f.label}{f.required ? " *" : ""}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-[11px] text-muted-foreground py-1.5 max-w-[120px] truncate">
                              {uploadData.preview[0]?.[header] ?? "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Required fields check */}
                  <div className="space-y-1">
                    {uploadData.module.fields.filter(f => f.required).map(f => {
                      const mapped = Object.values(mapping).includes(f.key);
                      return (
                        <div key={f.key} className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${mapped ? "text-emerald-700" : "text-amber-700 bg-amber-50"}`}>
                          {mapped ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                          {f.label} {f.required && "*"} {!mapped && "— non mappé"}
                        </div>
                      );
                    })}
                  </div>

                  {/* Preview */}
                  <div>
                    <p className="text-xs font-semibold mb-1.5 text-muted-foreground">Aperçu (5 premières lignes)</p>
                    <div className="overflow-x-auto border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {Object.entries(mapping).map(([h, k]) => (
                              <TableHead key={k} className="text-[11px] py-1 whitespace-nowrap">
                                {uploadData.module.fields.find(f => f.key === k)?.label ?? k}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {uploadData.preview.map((row, i) => (
                            <TableRow key={i}>
                              {Object.entries(mapping).map(([h, k]) => (
                                <TableCell key={k} className="text-[11px] py-1 max-w-[140px] truncate">{row[h] ?? "—"}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <Button onClick={() => validateMutation.mutate()} disabled={validateMutation.isPending}
                    className="w-full gap-2">
                    {validateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                    Valider les données
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── STEP 4 : Validation results ──────────────────────────────────── */}
          {step === "validate" && validationResult && (
            <div className="space-y-4 max-w-3xl mx-auto">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    {validationResult.canImport
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      : <AlertTriangle className="w-4 h-4 text-amber-500" />}
                    Rapport de validation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* KPIs */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Total lignes", value: validationResult.totalRows, color: "text-slate-700" },
                      { label: "Lignes valides", value: validationResult.validRows, color: "text-emerald-600" },
                      { label: "Lignes en erreur", value: validationResult.errorRows, color: validationResult.errorRows > 0 ? "text-red-600" : "text-emerald-600" },
                    ].map(k => (
                      <div key={k.label} className="rounded-lg border p-3 text-center">
                        <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                        <p className="text-xs text-muted-foreground">{k.label}</p>
                      </div>
                    ))}
                  </div>

                  {validationResult.unmappedRequired.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-sm font-semibold text-red-700 mb-1">Champs obligatoires non mappés :</p>
                      <div className="flex flex-wrap gap-1">
                        {validationResult.unmappedRequired.map(f => (
                          <span key={f} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">{f}</span>
                        ))}
                      </div>
                      <Button variant="outline" size="sm" className="mt-2 gap-1.5 text-xs" onClick={() => setStep("mapping")}>
                        <ArrowLeft className="w-3.5 h-3.5" /> Corriger le mapping
                      </Button>
                    </div>
                  )}

                  {validationResult.errors.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground">
                        {validationResult.errorCount} erreur(s) · {validationResult.warningCount} avertissement(s)
                      </p>
                      <div className="max-h-64 overflow-y-auto border rounded-lg divide-y text-xs">
                        {validationResult.errors.slice(0, 50).map((e, i) => (
                          <div key={i} className={`flex items-start gap-2 px-3 py-2 ${e.severity === "error" ? "bg-red-50" : "bg-amber-50"}`}>
                            {e.severity === "error"
                              ? <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                              : <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />}
                            <span className="text-muted-foreground shrink-0">Ligne {e.row}</span>
                            <span className="font-medium">{e.field} :</span>
                            <span>{e.message}</span>
                          </div>
                        ))}
                        {validationResult.errors.length > 50 && (
                          <div className="px-3 py-2 text-muted-foreground italic">… et {validationResult.errors.length - 50} autres</div>
                        )}
                      </div>
                    </div>
                  )}

                  {validationResult.canImport && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <p className="text-sm text-emerald-800 font-medium">
                        {validationResult.validRows} ligne(s) prête(s) à être importées.
                      </p>
                    </div>
                  )}

                  {/* Save mapping name */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">Sauvegarder ce mapping (optionnel)</Label>
                      <Input value={saveMappingName} onChange={e => setSaveMappingName(e.target.value)}
                        placeholder="ex : Export Sage 2024" className="h-8 text-xs mt-1" />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 gap-2" onClick={() => setStep("mapping")}>
                      <ArrowLeft className="w-4 h-4" /> Modifier le mapping
                    </Button>
                    <Button className="flex-1 gap-2" disabled={!validationResult.canImport || executeMutation.isPending}
                      onClick={() => executeMutation.mutate()}>
                      {executeMutation.isPending
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Import en cours…</>
                        : <><ArrowRight className="w-4 h-4" /> Lancer l'import</>}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── STEP 5 : Done ────────────────────────────────────────────────── */}
          {step === "done" && importResult && (
            <div className="max-w-lg mx-auto">
              <Card className="border-emerald-200">
                <CardContent className="p-8 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h2 className="text-xl font-bold">Import terminé !</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-emerald-50 p-3">
                      <p className="text-3xl font-bold text-emerald-700">{importResult.imported}</p>
                      <p className="text-xs text-emerald-600">ligne(s) importée(s)</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-3xl font-bold text-slate-600">{importResult.skipped}</p>
                      <p className="text-xs text-slate-500">ligne(s) ignorée(s)</p>
                    </div>
                  </div>

                  {importResult.errors.length > 0 && (
                    <div className="text-left space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground">Erreurs détectées :</p>
                      <div className="max-h-32 overflow-y-auto border rounded text-xs divide-y">
                        {importResult.errors.map((e, i) => (
                          <div key={i} className="flex gap-2 px-2 py-1.5 bg-red-50">
                            <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                            <span className="text-muted-foreground">Ligne {e.row} :</span>
                            <span>{e.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" className="flex-1 gap-2" onClick={resetWizard}>
                      <RefreshCw className="w-4 h-4" /> Importer un autre module
                    </Button>
                    <Button className="flex-1 gap-2" onClick={() => setTab("history")}>
                      <History className="w-4 h-4" /> Voir l'historique
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ── HISTORY ──────────────────────────────────────────────────────── */}
        <TabsContent value="history" className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground">Audit trail des imports</p>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => qc.invalidateQueries({ queryKey: ["migration-sessions"] })}>
              <RefreshCw className="w-3.5 h-3.5" /> Actualiser
            </Button>
          </div>

          {loadingSessions && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}

          {sessionsData?.sessions.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Database className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Aucun import effectué pour le moment.</p>
            </div>
          )}

          {(sessionsData?.sessions.length ?? 0) > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Module</TableHead>
                    <TableHead className="text-xs">Fichier</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Lignes</TableHead>
                    <TableHead className="text-xs">Importées</TableHead>
                    <TableHead className="text-xs">Erreurs</TableHead>
                    <TableHead className="text-xs">Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessionsData!.sessions.map(s => {
                    const mod = MODULES_LABELS[s.module] ?? s.module;
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="text-xs font-medium">{mod}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{s.fileName ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(s.createdAt)}</TableCell>
                        <TableCell className="text-xs">{s.totalRows ?? "—"}</TableCell>
                        <TableCell className="text-xs text-emerald-600 font-semibold">{s.importedRows ?? "—"}</TableCell>
                        <TableCell className="text-xs text-red-500">{s.errorRows ? (s.errorRows > 0 ? s.errorRows : "—") : "—"}</TableCell>
                        <TableCell><StatusBadge status={s.status} /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

const MODULES_LABELS: Record<string, string> = {
  clients: "Clients", contacts: "Contacts", collaborators: "Collaborateurs",
  invoices: "Factures clients", payments: "Encaissements",
  chart_of_accounts: "Plan comptable", projects: "Projets", equipment: "Équipements",
};
