import { useState } from "react";
import {
  ArrowLeft, Shield, CheckCircle, AlertTriangle, XCircle,
  RefreshCw, Download, ChevronRight, FileText, Eye,
  Edit3, Check, Flame, Info, Zap, BarChart2, Calendar,
  Clock, User, ExternalLink, ChevronDown, ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const ANOMALIES = [
  {
    id: 1, niveau: "bloquant", categorie: "TVA",
    titre: "TVA collectée incohérente avec les ventes",
    detail: "TVA collectée déclarée : 4 280 000 FCFA. TVA calculée sur CA comptable : 5 142 000 FCFA. Écart : 862 000 FCFA.",
    action: "Vérifier les factures clients du mois et les taux de TVA appliqués.",
    lien: "Factures clients > Juin 2025",
    corrige: false,
  },
  {
    id: 2, niveau: "eleve", categorie: "Justificatifs",
    titre: "TVA déductible sans justificatif",
    detail: "3 factures fournisseurs (BTP Gabon, CONLOG CI) comptabilisées sans pièce jointe validée. Montant concerné : 240 000 FCFA.",
    action: "Ajouter les justificatifs manquants dans le module Documents.",
    lien: "Factures fournisseurs > juin 2025",
    corrige: false,
  },
  {
    id: 3, niveau: "eleve", categorie: "Conformité",
    titre: "Numéro fiscal absent sur 2 factures clients",
    detail: "Factures FC-2025-087 et FC-2025-093 ne mentionnent pas le numéro d'identification fiscale du client.",
    action: "Mettre à jour les fiches clients SOGELEC et MinesCorp.",
    lien: "Clients > Fiches",
    corrige: false,
  },
  {
    id: 4, niveau: "moyen", categorie: "Rapprochement",
    titre: "Paiements non rapprochés",
    detail: "2 encaissements client non lettrés avec leurs factures (total : 580 000 FCFA).",
    action: "Effectuer le lettrage dans le module Paiements.",
    lien: "Paiements > Lettrage",
    corrige: true,
  },
  {
    id: 5, niveau: "moyen", categorie: "Cohérence",
    titre: "Chiffre d'affaires déclaré vs comptable",
    detail: "CA HT déclaré : 23 780 000 FCFA. CA HT comptable : 23 990 000 FCFA. Différence : 210 000 FCFA.",
    action: "Vérifier les avoirs et remises non comptabilisées.",
    lien: "Comptabilité > Journaux > Ventes",
    corrige: false,
  },
  {
    id: 6, niveau: "moyen", categorie: "Période",
    titre: "Écriture hors période fiscale",
    detail: "1 écriture de charge (compte 606) datée du 28 mai comptabilisée dans la période de juin.",
    action: "Vérifier la date de l'écriture J-2025-1124.",
    lien: "Comptabilité > Journal général",
    corrige: false,
  },
  {
    id: 7, niveau: "faible", categorie: "Documentation",
    titre: "Note explicative absente",
    detail: "Aucun commentaire sur la variation de TVA collectée par rapport au mois précédent (–8,4%).",
    action: "Ajouter une note justificative dans le champ Observations.",
    lien: null,
    corrige: true,
  },
];

const CONTROLES = [
  { label: "Cohérence TVA collectée / ventes", ok: false },
  { label: "TVA déductible justifiée", ok: false },
  { label: "Numéros fiscaux clients présents", ok: false },
  { label: "Paiements rapprochés", ok: true },
  { label: "CA déclaré = CA comptable", ok: false },
  { label: "Écritures dans la bonne période", ok: false },
  { label: "Taux de TVA corrects (18%)", ok: true },
  { label: "Doublons de déclaration absents", ok: true },
  { label: "Période fiscale correcte", ok: true },
  { label: "Retenues à la source déclarées", ok: true },
  { label: "Seuils fiscaux respectés", ok: true },
  { label: "Notes explicatives présentes", ok: true },
];

const NIVEAU_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  bloquant: { label: "Bloquant",           color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", icon: <XCircle className="w-4 h-4" /> },
  eleve:    { label: "Élevé",              color: "#D97706", bg: "#FFF7ED", border: "#FED7AA", icon: <Flame className="w-4 h-4" /> },
  moyen:    { label: "Moyen",              color: "#CA8A04", bg: "#FEFCE8", border: "#FEF08A", icon: <AlertTriangle className="w-4 h-4" /> },
  faible:   { label: "Faible",             color: "#6B7280", bg: "#F9FAFB", border: "#E5E7EB", icon: <Info className="w-4 h-4" /> },
};

function AnomalieCard({ a, expanded, onToggle }: { a: typeof ANOMALIES[0]; expanded: boolean; onToggle: () => void }) {
  const cfg = NIVEAU_CONFIG[a.niveau];
  return (
    <div className={`rounded-xl border transition-all ${a.corrige ? "opacity-60" : ""}`} style={{ borderColor: a.corrige ? "#E5E7EB" : cfg.border, background: a.corrige ? "#F9FAFB" : cfg.bg }}>
      <div className="flex items-start gap-3 p-4 cursor-pointer" onClick={onToggle}>
        <div className="mt-0.5 flex-shrink-0" style={{ color: cfg.color }}>{cfg.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: cfg.color, background: "rgba(0,0,0,0.06)" }}>{cfg.label}</span>
            <span className="text-[11px] text-gray-400 font-medium">{a.categorie}</span>
            {a.corrige && <span className="text-[11px] font-semibold text-green-600 flex items-center gap-1"><Check className="w-3 h-3" />Corrigé</span>}
          </div>
          <div className="text-[13px] font-semibold text-[#0E1A39] leading-snug">{a.titre}</div>
        </div>
        <div className="flex-shrink-0 text-gray-400">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t ml-7 pl-0 space-y-3">
          <p className="text-[12.5px] text-gray-600 leading-relaxed">{a.detail}</p>
          <div className="flex items-start gap-2 p-2.5 bg-white/70 rounded-lg border border-white">
            <Zap className="w-3.5 h-3.5 text-[#F37021] flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-gray-700"><strong className="text-[#0E1A39]">Action recommandée :</strong> {a.action}</p>
          </div>
          {a.lien && (
            <button className="flex items-center gap-1.5 text-[11.5px] text-[#2563EB] font-medium hover:underline">
              <ExternalLink className="w-3 h-3" />Ouvrir : {a.lien}
            </button>
          )}
          {!a.corrige && (
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" className="h-7 text-[11.5px] bg-[#0E1A39] hover:bg-[#1a2d5a] text-white border-0 gap-1">
                <Edit3 className="w-3 h-3" />Corriger
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[11.5px] gap-1">
                <Check className="w-3 h-3" />Marquer vérifié
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-[11.5px] text-gray-400 gap-1">
                <User className="w-3 h-3" />Demander validation
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function DetailDeclaration() {
  const [expanded, setExpanded] = useState<number | null>(1);
  const score = 72;
  const total = CONTROLES.length;
  const conformes = CONTROLES.filter(c => c.ok).length;
  const aCorrect = ANOMALIES.filter(a => !a.corrige).length;
  const bloquants = ANOMALIES.filter(a => a.niveau === "bloquant" && !a.corrige).length;

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-1 text-gray-400 hover:text-[#0E1A39] text-[12px] mr-2">
              <ArrowLeft className="w-4 h-4" />Liste
            </button>
            <div className="w-8 h-8 rounded-lg bg-[#FFF7ED] flex items-center justify-center">
              <FileText className="w-4 h-4 text-[#F37021]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[16px] font-bold text-[#0E1A39]">TVA — Juin 2025</h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />Corrections requises
                </span>
              </div>
              <p className="text-[11px] text-gray-400">D-2025-06 · Responsable : M. Agbeko · Échéance : 15 juil. 2025</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-[12px] gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />Relancer le contrôle
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-[12px] gap-1.5">
              <Download className="w-3.5 h-3.5" />Rapport PDF
            </Button>
            <Button size="sm" className="h-8 text-[12px] gap-1.5 bg-gray-200 text-gray-400 border-0 cursor-not-allowed" disabled>
              <Shield className="w-3.5 h-3.5" />Marquer prêt à soumettre
            </Button>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 max-w-[1100px] mx-auto">
        <div className="grid grid-cols-3 gap-5">
          {/* Left col — Score + Contrôles */}
          <div className="col-span-1 space-y-4">
            {/* Score */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 className="w-4 h-4 text-[#D97706]" />
                <h3 className="text-[13px] font-bold text-[#0E1A39]">Score de conformité</h3>
              </div>
              {/* Gauge */}
              <div className="flex flex-col items-center mb-5">
                <div className="relative w-32 h-16 overflow-hidden mb-2">
                  <svg viewBox="0 0 120 60" className="w-full h-full">
                    <path d="M10,60 A50,50 0 0,1 110,60" fill="none" stroke="#F3F4F6" strokeWidth="10" strokeLinecap="round" />
                    <path d="M10,60 A50,50 0 0,1 110,60" fill="none" stroke="#D97706" strokeWidth="10" strokeLinecap="round"
                      strokeDasharray={`${(score / 100) * 157} 157`} />
                    <text x="60" y="52" textAnchor="middle" fontSize="20" fontWeight="800" fill="#0E1A39">{score}</text>
                    <text x="60" y="62" textAnchor="middle" fontSize="9" fill="#9CA3AF">/ 100</text>
                  </svg>
                </div>
                <div className="text-center">
                  <div className="text-[11px] font-semibold text-[#D97706]">Corrections requises</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Résoudre les erreurs avant soumission</div>
                </div>
              </div>
              <div className="space-y-2 text-[12px]">
                {[
                  { label: "Contrôles effectués", val: total, color: "#0E1A39" },
                  { label: "Conformes", val: conformes, color: "#059669" },
                  { label: "À corriger", val: aCorrect, color: "#D97706" },
                  { label: "Bloquants", val: bloquants, color: "#DC2626" },
                ].map((r, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-gray-500">{r.label}</span>
                    <span className="font-bold" style={{ color: r.color }}>{r.val}</span>
                  </div>
                ))}
              </div>
              {bloquants > 0 && (
                <div className="mt-3 p-2.5 bg-red-50 rounded-lg border border-red-100 flex items-start gap-2">
                  <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-red-700 leading-snug">La déclaration ne peut pas être soumise tant qu'il existe des erreurs bloquantes.</p>
                </div>
              )}
            </div>

            {/* Points de contrôle */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="text-[13px] font-bold text-[#0E1A39] mb-3">Points de contrôle</h3>
              <div className="space-y-1.5">
                {CONTROLES.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {c.ok
                      ? <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      : <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                    <span className={`text-[11.5px] ${c.ok ? "text-gray-500" : "text-gray-700 font-medium"}`}>{c.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Montants */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="text-[13px] font-bold text-[#0E1A39] mb-3">Montants déclarés</h3>
              <div className="space-y-2 text-[12px]">
                {[
                  { label: "CA HT déclaré", val: "23 780 000 FCFA" },
                  { label: "TVA collectée", val: "4 280 400 FCFA" },
                  { label: "TVA déductible", val: "1 243 600 FCFA" },
                  { label: "TVA nette à payer", val: "3 036 800 FCFA" },
                ].map((r, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-gray-50 pb-1.5 last:border-0 last:pb-0">
                    <span className="text-gray-500">{r.label}</span>
                    <span className="font-semibold text-[#0E1A39]">{r.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right col — Anomalies + Historique */}
          <div className="col-span-2 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[14px] font-bold text-[#0E1A39]">
                  Anomalies détectées
                  <span className="ml-2 text-[11px] font-normal text-gray-400">{ANOMALIES.filter(a => !a.corrige).length} actives</span>
                </h3>
                <div className="flex items-center gap-2 text-[11px] text-gray-400">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Bloquant</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />Élevé</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />Moyen</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />Faible</span>
                </div>
              </div>
              <div className="space-y-2">
                {ANOMALIES.map(a => (
                  <AnomalieCard key={a.id} a={a} expanded={expanded === a.id} onToggle={() => setExpanded(expanded === a.id ? null : a.id)} />
                ))}
              </div>
            </div>

            {/* Historique */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="text-[13px] font-bold text-[#0E1A39] mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />Historique des vérifications
              </h3>
              <div className="space-y-2">
                {[
                  { date: "07 juil. 2025 – 14:32", action: "Contrôle relancé par M. Agbeko", detail: "7 anomalies détectées (1 bloquant, 2 élevés, 3 moyens, 1 faible)" },
                  { date: "07 juil. 2025 – 11:15", action: "Correction validée : lettrage des paiements", detail: "Anomalie #4 marquée comme corrigée" },
                  { date: "07 juil. 2025 – 10:47", action: "Note ajoutée : variation TVA", detail: "Anomalie #7 marquée comme vérifiée" },
                  { date: "06 juil. 2025 – 16:03", action: "Première vérification lancée", detail: "Score initial : 58% — 9 anomalies détectées" },
                  { date: "05 juil. 2025 – 09:21", action: "Déclaration créée par M. Agbeko", detail: "Import des données depuis la comptabilité — Juin 2025" },
                ].map((h, i) => (
                  <div key={i} className="flex gap-3 text-[12px]">
                    <div className="flex flex-col items-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#0E1A39] mt-1.5 flex-shrink-0" />
                      {i < 4 && <div className="w-px bg-gray-100 flex-1 mt-1" />}
                    </div>
                    <div className="pb-2">
                      <div className="font-semibold text-[#0E1A39]">{h.action}</div>
                      <div className="text-gray-400">{h.detail}</div>
                      <div className="text-[10.5px] text-gray-300 mt-0.5">{h.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
