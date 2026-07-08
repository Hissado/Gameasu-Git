import { useState } from "react";
import {
  FileText, Search, Filter, Plus, CheckCircle, AlertTriangle,
  XCircle, Clock, ChevronRight, Shield, BarChart2, RefreshCw,
  Download, ArrowUpRight, Calendar, Building2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STATUTS = [
  { value: "all", label: "Tous" },
  { value: "brouillon", label: "Brouillon" },
  { value: "en_verification", label: "En vérification" },
  { value: "corrections", label: "Corrections requises" },
  { value: "conforme", label: "Conforme" },
  { value: "soumis", label: "Soumis" },
];

const DECLARATIONS = [
  {
    id: "D-2025-06",
    type: "TVA",
    periode: "Juin 2025",
    echeance: "15 juil. 2025",
    statut: "corrections",
    score: 72,
    alertes: { bloquant: 1, eleve: 2, moyen: 3, faible: 1 },
    montant: "4 280 000",
    responsable: "M. Agbeko",
  },
  {
    id: "D-2025-05",
    type: "TVA",
    periode: "Mai 2025",
    echeance: "15 juin 2025",
    statut: "soumis",
    score: 98,
    alertes: { bloquant: 0, eleve: 0, moyen: 1, faible: 1 },
    montant: "3 950 000",
    responsable: "M. Agbeko",
  },
  {
    id: "D-2025-Q2",
    type: "Impôt sur sociétés",
    periode: "T2 2025",
    echeance: "30 juil. 2025",
    statut: "en_verification",
    score: 84,
    alertes: { bloquant: 0, eleve: 1, moyen: 4, faible: 2 },
    montant: "12 750 000",
    responsable: "S. Kpossou",
  },
  {
    id: "D-2025-06-RS",
    type: "Retenues à la source",
    periode: "Juin 2025",
    echeance: "10 juil. 2025",
    statut: "conforme",
    score: 100,
    alertes: { bloquant: 0, eleve: 0, moyen: 0, faible: 0 },
    montant: "890 000",
    responsable: "S. Kpossou",
  },
  {
    id: "D-2025-07",
    type: "TVA",
    periode: "Juillet 2025",
    echeance: "15 août 2025",
    statut: "brouillon",
    score: null,
    alertes: { bloquant: 0, eleve: 0, moyen: 0, faible: 0 },
    montant: "—",
    responsable: "M. Agbeko",
  },
  {
    id: "D-2025-06-TS",
    type: "Taxes sur salaires",
    periode: "Juin 2025",
    echeance: "25 juil. 2025",
    statut: "en_verification",
    score: 91,
    alertes: { bloquant: 0, eleve: 0, moyen: 2, faible: 3 },
    montant: "1 240 000",
    responsable: "M. Agbeko",
  },
];

const STATUT_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; bg: string }> = {
  brouillon:       { label: "Brouillon",            color: "#6B7280", bg: "#F3F4F6", icon: <Clock className="w-3.5 h-3.5" /> },
  en_verification: { label: "En vérification",      color: "#2563EB", bg: "#EFF6FF", icon: <RefreshCw className="w-3.5 h-3.5" /> },
  corrections:     { label: "Corrections requises", color: "#D97706", bg: "#FFF7ED", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  conforme:        { label: "Conforme",              color: "#059669", bg: "#ECFDF5", icon: <CheckCircle className="w-3.5 h-3.5" /> },
  pret:            { label: "Prêt à soumettre",      color: "#7C3AED", bg: "#F5F3FF", icon: <Shield className="w-3.5 h-3.5" /> },
  soumis:          { label: "Soumis",                color: "#0E1A39", bg: "#EFF6FF", icon: <ArrowUpRight className="w-3.5 h-3.5" /> },
  archive:         { label: "Archivé",               color: "#9CA3AF", bg: "#F9FAFB", icon: <FileText className="w-3.5 h-3.5" /> },
};

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-400 text-sm">—</span>;
  const color = score >= 90 ? "#059669" : score >= 70 ? "#D97706" : "#DC2626";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-[13px] font-semibold" style={{ color }}>{score}%</span>
    </div>
  );
}

function StatutBadge({ statut }: { statut: string }) {
  const cfg = STATUT_CONFIG[statut] ?? STATUT_CONFIG.brouillon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ color: cfg.color, background: cfg.bg }}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function AlertSummary({ alertes }: { alertes: { bloquant: number; eleve: number; moyen: number; faible: number } }) {
  const total = alertes.bloquant + alertes.eleve + alertes.moyen + alertes.faible;
  if (total === 0) return <span className="text-[12px] text-gray-400">Aucune alerte</span>;
  return (
    <div className="flex items-center gap-1">
      {alertes.bloquant > 0 && <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700">{alertes.bloquant} bloquant</span>}
      {alertes.eleve > 0 && <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">{alertes.eleve} élevé</span>}
      {alertes.moyen > 0 && <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">{alertes.moyen} moyen</span>}
      {alertes.faible > 0 && <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{alertes.faible} faible</span>}
    </div>
  );
}

export function ListeDeclarations() {
  const [search, setSearch] = useState("");
  const [statut, setStatut] = useState("all");

  const filtered = DECLARATIONS.filter(d => {
    const matchSearch = d.type.toLowerCase().includes(search.toLowerCase()) || d.periode.toLowerCase().includes(search.toLowerCase()) || d.id.toLowerCase().includes(search.toLowerCase());
    const matchStatut = statut === "all" || d.statut === statut;
    return matchSearch && matchStatut;
  });

  const total = DECLARATIONS.length;
  const conformes = DECLARATIONS.filter(d => d.score !== null && d.score >= 90).length;
  const enAlerte = DECLARATIONS.filter(d => d.alertes.bloquant > 0).length;
  const enCours = DECLARATIONS.filter(d => d.statut === "en_verification").length;

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-8 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#0E1A39] flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-[17px] font-bold text-[#0E1A39] leading-tight">Contrôle fiscal préalable</h1>
              <p className="text-[12px] text-gray-400">Vérification des déclarations avant soumission à l'OTR</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-[12px] gap-1.5">
              <Download className="w-3.5 h-3.5" />Exporter
            </Button>
            <Button size="sm" className="h-8 text-[12px] gap-1.5 bg-[#F37021] hover:bg-[#E06010] text-white border-0">
              <Plus className="w-3.5 h-3.5" />Nouvelle déclaration
            </Button>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 max-w-[1200px] mx-auto space-y-5">
        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Déclarations", value: total, sub: "ce trimestre", icon: <FileText className="w-4 h-4" />, color: "#0E1A39", bg: "#EFF6FF" },
            { label: "En vérification", value: enCours, sub: "en cours d'analyse", icon: <RefreshCw className="w-4 h-4" />, color: "#2563EB", bg: "#EFF6FF" },
            { label: "Conformes (≥90%)", value: conformes, sub: "score de conformité", icon: <CheckCircle className="w-4 h-4" />, color: "#059669", bg: "#ECFDF5" },
            { label: "Alertes bloquantes", value: enAlerte, sub: "déclarations bloquées", icon: <XCircle className="w-4 h-4" />, color: "#DC2626", bg: "#FEF2F2" },
          ].map((kpi, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{kpi.label}</span>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: kpi.bg, color: kpi.color }}>{kpi.icon}</div>
              </div>
              <div className="text-[28px] font-extrabold leading-none" style={{ color: kpi.color }}>{kpi.value}</div>
              <p className="text-[11px] text-gray-400 mt-1">{kpi.sub}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une déclaration…" className="pl-9 h-8 text-[13px] border-gray-200" />
          </div>
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
            {STATUTS.map(s => (
              <button key={s.value} onClick={() => setStatut(s.value)}
                className={`px-3 py-1 rounded-md text-[11.5px] font-medium transition-colors ${statut === s.value ? "bg-[#0E1A39] text-white" : "text-gray-500 hover:text-gray-700"}`}>
                {s.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="h-8 text-[12px] gap-1.5 ml-auto">
            <Filter className="w-3.5 h-3.5" />Filtres avancés
          </Button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/60">
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Déclaration</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Période</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Statut</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Score</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Alertes</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Montant (FCFA)</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Échéance</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(d => (
                <tr key={d.id} className="hover:bg-gray-50/50 cursor-pointer transition-colors group">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#F0F4FF] flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-[#2563EB]" />
                      </div>
                      <div>
                        <div className="text-[13px] font-semibold text-[#0E1A39]">{d.type}</div>
                        <div className="text-[11px] text-gray-400">{d.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-gray-300" />
                      <span className="text-[13px] text-gray-600">{d.periode}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5"><StatutBadge statut={d.statut} /></td>
                  <td className="px-4 py-3.5"><ScoreBadge score={d.score} /></td>
                  <td className="px-4 py-3.5"><AlertSummary alertes={d.alertes} /></td>
                  <td className="px-4 py-3.5">
                    <span className="text-[13px] font-semibold text-[#0E1A39]">{d.montant !== "—" ? d.montant + " FCFA" : "—"}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${d.statut === "corrections" ? "bg-orange-400" : d.statut === "soumis" ? "bg-green-400" : "bg-gray-300"}`} />
                      <span className="text-[12px] text-gray-500">{d.echeance}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#0E1A39] transition-colors ml-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-gray-400 text-sm">Aucune déclaration trouvée.</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[11px] text-gray-400">
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            <span>Administration fiscale configurée : <strong className="text-gray-600">OTR — Office Togolais des Recettes</strong></span>
          </div>
          <span>{filtered.length} déclaration{filtered.length > 1 ? "s" : ""} affichée{filtered.length > 1 ? "s" : ""}</span>
        </div>
      </div>
    </div>
  );
}
