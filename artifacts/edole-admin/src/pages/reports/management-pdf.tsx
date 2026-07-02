import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";

// ─── Types (mirror ManagementReport from index.tsx) ──────────────────────────
type MonthlyData = { month: string; revenues: number; expenses: number; netResult: number };
type ArClient     = { name: string; outstanding: number; overdue: number; percent: number };
type ApSupplier   = { name: string; outstanding: number; overdue: number; percent: number };
type ExpBreakdown = { code: string; label: string; amount: number; percent: number };
type HealthCheck  = { cat: string; label: string; curr: number; prev: number | null; target: string; targetNum: number | null; achieved: boolean; importance: string; isPercent: boolean; isMoney: boolean };

type ManagementReport = {
  org?: { name: string; legalName: string; logoUrl: string | null; country: string };
  period: { from: string; to: string };
  prev: { revenues: number; expenses: number; netResult: number; margin: number; from: string; to: string };
  finance: {
    revenues: number; expenses: number; netResult: number; margin: number;
    grossMargin: number; ebitda: number; operatingExpenseRatio: number;
  };
  liquidity: {
    cashPosition: number; workingCapital: number;
    arOutstanding: number; arOverdue: number; debtorsDays: number;
    apOutstanding: number; apOverdue: number; creditorsDays: number;
  };
  operations: { activeProjects: number; completedProjects: number; overdueProjects: number; avgProgress: number; activeTasks: number };
  hr: { activeCollab: number; byContractType: Record<string, number> };
  series: MonthlyData[];
  topArClients: ArClient[];
  topApSuppliers: ApSupplier[];
  expenseBreakdown: ExpBreakdown[];
  ytd?: { revenues: number; expenses: number; netResult: number; margin: number; oer: number; prevRevenues: number; prevExpenses: number; prevNetResult: number; prevMargin: number; prevOer: number; from: string; to: string };
  breakEven?: { bep: number | null; fixedCosts: number; variableCosts: number; contributionRatio: number; operatingResult: number };
  healthScore?: { score: number; achieved: number; total: number; checks: HealthCheck[] };
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function apiFetch(url: string): Promise<ManagementReport> {
  const token = localStorage.getItem("auth_token");
  return fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
}

const fcfa = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(n);

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
};

const compact = (n: number) => {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + " Md";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + " M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(0) + " k";
  return String(n);
};

const sign = (n: number, prev: number) => {
  if (prev === 0) return null;
  const pct = Math.round(((n - prev) / Math.abs(prev)) * 1000) / 10;
  return pct;
};

// ─── Print CSS injected globally ─────────────────────────────────────────────
const PRINT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Inter', -apple-system, sans-serif; background: #f8fafc; color: #1e293b; }

.screen-toolbar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 999;
  display: flex; align-items: center; justify-between; gap: 12px;
  padding: 10px 20px;
  background: #1e293b; color: #fff;
  box-shadow: 0 2px 12px rgba(0,0,0,.25);
}
.screen-toolbar h1 { font-size: 14px; font-weight: 700; flex:1; }
.screen-toolbar span { font-size: 12px; color: #94a3b8; }
.toolbar-btn {
  padding: 7px 16px; border-radius: 8px; font-size: 13px; font-weight: 600;
  cursor: pointer; border: none; display: flex; align-items: center; gap: 6px;
}
.btn-print { background: #f97316; color: #fff; }
.btn-close  { background: #334155; color: #fff; }
.btn-print:hover { background: #ea6c08; }
.btn-close:hover  { background: #475569; }

.report-container { max-width: 820px; margin: 72px auto 40px; display: flex; flex-direction: column; gap: 0; }

.pdf-page {
  background: #fff;
  margin-bottom: 28px;
  border-radius: 8px;
  box-shadow: 0 2px 16px rgba(0,0,0,.08);
  overflow: hidden;
  page-break-after: always;
  page-break-inside: avoid;
}
.pdf-page:last-child { page-break-after: auto; }

/* ─── Typography ─── */
.page-section-title {
  font-size: 8.5px; font-weight: 700; letter-spacing: 1.8px; text-transform: uppercase; color: #94a3b8;
  margin-bottom: 4px;
}
.h1 { font-size: 26px; font-weight: 900; color: #0f172a; line-height: 1.1; }
.h2 { font-size: 16px; font-weight: 800; color: #0f172a; }
.h3 { font-size: 13px; font-weight: 700; color: #334155; }
.h4 { font-size: 11px; font-weight: 700; color: #475569; letter-spacing: .5px; text-transform: uppercase; }
.body-text { font-size: 12.5px; color: #475569; line-height: 1.65; }
.caption { font-size: 10.5px; color: #94a3b8; }

/* ─── Cover — bicolonne dark/white ─── */
.cover-top-stripe { height: 5px; background: #2563EB; }
.cover-body { display: flex; min-height: 380px; }

.cover-sidebar {
  width: 34%; background: #0f1a3a; color: #fff;
  padding: 44px 36px; display: flex; flex-direction: column; justify-content: space-between;
}
.cover-sidebar-tag { font-size: 9px; letter-spacing: 2.5px; text-transform: uppercase; color: rgba(255,255,255,.4); font-weight: 700; }
.cover-sidebar-rule { width: 32px; height: 2px; background: #2563EB; margin: 10px 0 14px; }
.cover-sidebar-prep { font-size: 11px; color: rgba(255,255,255,.5); line-height: 1.6; }
.cover-sidebar-name { font-size: 13px; font-weight: 700; color: #fff; margin-top: 2px; }
.cover-sidebar-status { display: flex; align-items: center; gap: 7px; margin-top: 20px; }
.cover-sidebar-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.cover-sidebar-status-text { font-size: 10px; color: rgba(255,255,255,.45); }
.cover-sidebar-date { font-size: 9px; color: rgba(255,255,255,.25); font-family: monospace; margin-top: 4px; }

.cover-main {
  flex: 1; background: #fff;
  padding: 44px 48px; display: flex; flex-direction: column; justify-content: space-between;
}
.cover-main-org { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #2563EB; font-weight: 700; text-align: right; margin-bottom: 4px; }
.cover-main-orgname { font-size: 20px; font-weight: 900; color: #0f1a3a; text-align: right; letter-spacing: -0.5px; }

.cover-title-block { margin-top: 32px; }
.cover-rule { width: 40px; height: 3px; background: #2563EB; margin-bottom: 20px; }
.cover-subtitle { font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: rgba(0,0,0,.4); font-weight: 700; margin-bottom: 8px; }
.cover-title { font-size: 40px; font-weight: 900; color: #0f1a3a; line-height: 0.95; margin-bottom: 12px; }
.cover-title span { color: #2563EB; }
.cover-period { font-size: 14px; color: #64748b; margin-top: 16px; font-weight: 500; }

.cover-health { text-align: right; margin-top: auto; padding-top: 24px; }
.cover-health-label { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: #94a3b8; font-weight: 700; margin-bottom: 4px; }
.cover-health-score { font-size: 44px; font-weight: 900; line-height: 1; }
.cover-health-desc { font-size: 11px; color: #64748b; margin-top: 2px; }

.cover-footer {
  background: #f8fafc; padding: 20px 48px 20px 48px;
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px;
  border-top: 1px solid #e2e8f0;
}
.cover-kpi { padding: 12px 16px 12px 0; border-right: 1px solid #e2e8f0; min-width: 0; overflow: hidden; }
.cover-kpi:last-child { border-right: none; }
.cover-kpi-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; font-weight: 700; margin-bottom: 4px; }
.cover-kpi-value { font-size: 14px; font-weight: 800; word-break: break-word; overflow-wrap: anywhere; min-width: 0; line-height: 1.3; }
.kpi-green { color: #10b981; } .kpi-red { color: #ef4444; } .kpi-blue { color: #3b82f6; }

/* ─── Page header ─── */
.page-header { padding: 20px 32px 0; display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
.page-header-left { display: flex; align-items: center; gap: 12px; }
.page-num { width: 28px; height: 28px; border-radius: 8px; background: #f97316; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; flex-shrink: 0; }
.page-content { padding: 0 32px 32px; }

/* ─── KPI Grid ─── */
.kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 20px; }
.kpi-grid-2 { grid-template-columns: repeat(2,1fr); }
.kpi-grid-3 { grid-template-columns: repeat(3,1fr); }
.kpi-card {
  padding: 14px 16px; border-radius: 8px; border: 1px solid #e2e8f0;
  background: #f8fafc; min-width: 0; overflow: hidden;
}
.kpi-card-lbl { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #94a3b8; margin-bottom: 4px; }
.kpi-card-val { font-size: 16px; font-weight: 800; color: #0f172a; line-height: 1.2; margin-bottom: 3px; word-break: break-word; overflow-wrap: anywhere; min-width: 0; }
.kpi-card-sub { font-size: 10px; color: #94a3b8; }
.kpi-accent-green { border-left: 3px solid #10b981; }
.kpi-accent-red   { border-left: 3px solid #ef4444; }
.kpi-accent-blue  { border-left: 3px solid #3b82f6; }
.kpi-accent-orange { border-left: 3px solid #f97316; }
.kpi-accent-amber { border-left: 3px solid #f59e0b; }
.kpi-accent-violet { border-left: 3px solid #8b5cf6; }

/* ─── Badge / Trend ─── */
.badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 700; }
.badge-green { background: #d1fae5; color: #065f46; }
.badge-red   { background: #fee2e2; color: #991b1b; }
.badge-amber { background: #fef3c7; color: #92400e; }
.badge-blue  { background: #dbeafe; color: #1e40af; }
.badge-slate { background: #f1f5f9; color: #475569; }

/* ─── Section divider ─── */
.section-divider { border: none; border-top: 1px solid #f1f5f9; margin: 16px 0; }
.section-label { font-size: 9px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #cbd5e1; margin-bottom: 10px; }

/* ─── Narrative blocks ─── */
.narrative-row {
  display: flex; gap: 0; border-bottom: 1px solid #f1f5f9; margin-bottom: 0;
}
.narrative-row:last-child { border-bottom: none; }
.narrative-bar { width: 3px; flex-shrink: 0; border-radius: 2px; }
.bar-green { background: #10b981; } .bar-amber { background: #f59e0b; } .bar-blue { background: #3b82f6; }
.narrative-content { padding: 12px 16px; flex: 1; }
.narrative-tag { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 3px; }
.narrative-headline { font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 3px; }
.narrative-body { font-size: 11.5px; color: #64748b; line-height: 1.55; }

/* ─── Table ─── */
.pdf-table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
.pdf-table th { background: #f8fafc; padding: 7px 10px; text-align: left; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: #64748b; border-bottom: 1px solid #e2e8f0; }
.pdf-table th.right, .pdf-table td.right { text-align: right; }
.pdf-table th.center, .pdf-table td.center { text-align: center; }
.pdf-table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; color: #334155; }
.pdf-table tr:last-child td { border-bottom: none; }
.pdf-table tr:hover td { background: #fafafa; }
.pdf-table .cat-row td { background: #f8fafc; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: #94a3b8; padding: 5px 10px; }
.pdf-table .bold { font-weight: 700; color: #0f172a; }
.pdf-table .mono { font-family: 'Courier New', monospace; font-size: 10.5px; }
.pdf-table .text-green { color: #059669; font-weight: 600; }
.pdf-table .text-red { color: #dc2626; font-weight: 600; }
.pdf-table .text-amber { color: #d97706; font-weight: 600; }

/* ─── CSS Bar chart ─── */
.bar-chart { display: flex; flex-direction: column; gap: 6px; }
.bar-row { display: flex; align-items: center; gap: 8px; }
.bar-label { font-size: 10px; color: #475569; width: 90px; flex-shrink: 0; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bar-track { flex: 1; height: 10px; background: #f1f5f9; border-radius: 5px; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 5px; }
.bar-value { font-size: 10px; font-weight: 700; color: #334155; width: 80px; flex-shrink: 0; }

/* ─── Health ring ─── */
.health-ring-wrap { display: flex; align-items: center; gap: 24px; padding: 16px 0; }
.health-ring { position: relative; width: 80px; height: 80px; flex-shrink: 0; }
.health-ring svg { transform: rotate(-90deg); }
.health-ring-center { position: absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
.ring-score { font-size: 18px; font-weight: 900; }
.ring-label { font-size: 9px; color: #94a3b8; font-weight: 600; }
.health-checks { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
.health-check-dot { width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; }
.dot-ok  { background: #d1fae5; color: #065f46; }
.dot-nok { background: #fee2e2; color: #991b1b; }

/* ─── Watchpoint alert ─── */
.alert-box { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; }
.alert-box-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.alert-box-title { font-size: 12px; font-weight: 700; color: #92400e; }
.alert-item { font-size: 11px; color: #b45309; line-height: 1.5; padding: 3px 0; padding-left: 12px; position: relative; }
.alert-item::before { content: '•'; position: absolute; left: 0; }

/* ─── Monthly chart (pure CSS) ─── */
.monthly-chart { display: flex; align-items: flex-end; gap: 3px; height: 100px; padding: 0 4px; }
.month-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.month-bars { display: flex; gap: 2px; align-items: flex-end; height: 80px; }
.month-bar { width: 7px; border-radius: 2px 2px 0 0; }
.month-label { font-size: 7.5px; color: #94a3b8; font-weight: 600; }

/* ─── Two columns ─── */
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }

/* ─── Progress bar ─── */
.progress-track { height: 6px; background: #f1f5f9; border-radius: 3px; overflow: hidden; margin-top: 4px; }
.progress-fill { height: 100%; border-radius: 3px; }

/* ─── Separator box ─── */
.info-box { background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; padding: 14px 16px; }

/* ─── Page footer ─── */
.page-footer {
  border-top: 1px solid #f1f5f9; padding: 10px 32px;
  display: flex; align-items: center; justify-content: space-between;
}
.pf-logo { font-size: 11px; font-weight: 800; color: #1e293b; letter-spacing: -.3px; }
.pf-logo span { color: #f97316; }
.pf-info { font-size: 9.5px; color: #94a3b8; }

/* ─── Print ─── */
@media print {
  body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .screen-toolbar { display: none !important; }
  .report-container {
    margin-top: 0 !important;
    max-width: 100% !important;
    width: 100% !important;
  }
  .pdf-page {
    box-shadow: none !important;
    margin-bottom: 0 !important;
    border-radius: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
    overflow: hidden !important;
    page-break-after: always; page-break-inside: avoid;
    break-after: page; break-inside: avoid;
  }
  .pdf-page:last-child { page-break-after: auto; break-after: auto; }
  /* KPI cards: prevent overflow with large FCFA amounts */
  .kpi-card { page-break-inside: avoid; break-inside: avoid; }
  .kpi-card-val { font-size: 13px !important; }
  .cover-kpi-value { font-size: 12px !important; }
  /* Tables */
  .pdf-table { table-layout: fixed; width: 100% !important; }
  .pdf-table td, .pdf-table th { word-break: break-word; overflow-wrap: break-word; }
  /* Two-col blocks stay side by side on print */
  .two-col, .three-col { display: grid !important; }
  .kpi-grid { display: grid !important; }
  @page { margin: 10mm 12mm; size: A4 portrait; }
}
`;

// ─── Component ───────────────────────────────────────────────────────────────
export default function ManagementPDFPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const periodQuery = params.toString();
  const styleRef = useRef<HTMLStyleElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [saving, setSaving] = useState(false);

  // Inject print CSS
  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = PRINT_CSS;
    document.head.appendChild(el);
    styleRef.current = el;
    return () => { el.remove(); };
  }, []);

  const { data, isLoading, isError } = useQuery<ManagementReport>({
    queryKey: ["mgmt-pdf", periodQuery],
    queryFn: () => apiFetch(`/api/reports/management?${periodQuery}`),
    retry: 1,
  });

  const generatedAt = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const [showFmtMenu, setShowFmtMenu] = useState(false);

  async function savePdf(orientation: "portrait" | "landscape" = "portrait") {
    if (!containerRef.current || saving) return;
    setShowFmtMenu(false);
    setSaving(true);
    try {
      const [{ toCanvas }, { default: jsPDF }] = await Promise.all([
        import("html-to-image"),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        import("jspdf") as any,
      ]);

      const pages = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(".pdf-page")
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation } as any);
      const pageW = pdf.internal.pageSize.getWidth();   // portrait: 210, landscape: 297
      const pageH = pdf.internal.pageSize.getHeight();  // portrait: 297, landscape: 210

      const MARGIN = 8; // mm
      const cW = pageW - 2 * MARGIN;

      for (let i = 0; i < pages.length; i++) {
        const canvas = await toCanvas(pages[i], {
          pixelRatio: 2,
          backgroundColor: "#ffffff",
          skipAutoScale: false,
        });
        const imgData = canvas.toDataURL("image/jpeg", 0.97);
        if (i > 0) pdf.addPage();

        // Preserve aspect ratio, anchor top-left.
        const imgH = (canvas.height / canvas.width) * cW;

        if (imgH > pageH - 2 * MARGIN) {
          // Rare: content taller than one page — scale to fit height
          const fH = pageH - 2 * MARGIN;
          const fW = (canvas.width / canvas.height) * fH;
          const xOff = MARGIN + (cW - fW) / 2;
          pdf.addImage(imgData, "JPEG", xOff, MARGIN, fW, fH);
        } else {
          pdf.addImage(imgData, "JPEG", MARGIN, MARGIN, cW, imgH);
        }
      }

      const orient = orientation === "landscape" ? "-paysage" : "";
      pdf.save(`rapport-gestion${orient}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif", color: "#64748b", flexDirection: "column", gap: 12 }}>
      <div style={{ width: 36, height: 36, border: "3px solid #e2e8f0", borderTopColor: "#f97316", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      <div style={{ fontSize: 13, fontWeight: 600 }}>Génération du rapport PDF…</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (isError || !data) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif", color: "#ef4444", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 32 }}>⚠</div>
      <div style={{ fontSize: 14, fontWeight: 700 }}>Impossible de charger les données</div>
      <button onClick={() => window.close()} style={{ marginTop: 12, padding: "8px 18px", background: "#f97316", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>Fermer</button>
    </div>
  );

  const d = data;
  const orgName = d.org?.name ?? "Mon Organisation";
  const f = d.finance;
  const liq = d.liquidity;
  const ops = d.operations;
  const be = d.breakEven ?? { bep: null, fixedCosts: f.expenses, variableCosts: 0, contributionRatio: 0, operatingResult: f.netResult };
  const hs = d.healthScore ?? { score: 0, achieved: 0, total: 0, checks: [] };
  const periodLabel = `${fmtDate(d.period.from)} – ${fmtDate(d.period.to)}`;

  const revenueChg = sign(f.revenues, d.prev.revenues);
  const expenseChg = sign(f.expenses, d.prev.expenses);
  const netChg     = sign(f.netResult, d.prev.netResult);
  const oerPrev    = d.prev.revenues > 0 ? Math.round((d.prev.expenses / d.prev.revenues) * 1000) / 10 : 0;

  const watchpoints: string[] = [];
  if (liq.arOverdue > 0) watchpoints.push(`${fcfa(liq.arOverdue)} de créances clients en dépassement d'échéance.`);
  if (liq.apOverdue > 0) watchpoints.push(`${fcfa(liq.apOverdue)} de dettes fournisseurs en dépassement d'échéance.`);
  if (ops.overdueProjects > 0) watchpoints.push(`${ops.overdueProjects} projet(s) actif(s) dépassent la date de livraison prévue.`);
  if (liq.cashPosition < 0) watchpoints.push(`La trésorerie est négative : ${fcfa(liq.cashPosition)}.`);
  if (f.netResult < 0) watchpoints.push(`Résultat net déficitaire sur la période.`);

  const hsColor = hs.score >= 70 ? "#10b981" : hs.score >= 40 ? "#f59e0b" : "#ef4444";
  const hsLabel = hs.score >= 70 ? "Santé satisfaisante" : hs.score >= 40 ? "Points d'amélioration" : "Situation préoccupante";

  // CSS bar chart max for monthly series
  const maxRev = Math.max(...d.series.map(m => m.revenues), 1);
  const maxExp = Math.max(...d.series.map(m => m.expenses), 1);
  const maxBar = Math.max(maxRev, maxExp);

  // Max for expense breakdown
  const maxExpAmt = Math.max(...d.expenseBreakdown.map(e => e.amount), 1);

  // ─── Page footer ─────────────────────────────────────────────────────────
  function PageFooter({ page, total = 8 }: { page: number; total?: number }) {
    return (
      <div className="page-footer">
        <div className="pf-logo">{orgName}</div>
        <div className="pf-info">{periodLabel} · Confidentiel · Réservé à l'usage de la Direction</div>
        <div className="pf-info">Page {page} / {total}</div>
      </div>
    );
  }

  return (
    <>
      {/* ── Toolbar screen-only ──────────────────────────────────────────── */}
      <div className="screen-toolbar">
        <h1>Rapport de Gestion — Aperçu PDF</h1>
        <span>{periodLabel}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>

          {/* ── Format picker ─────────────────────────────────────────────── */}
          <div style={{ position: "relative" }}>
            <button
              className="toolbar-btn btn-print"
              disabled={saving}
              onClick={() => setShowFmtMenu(v => !v)}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              {saving ? "⏳ Génération…" : "⬇ Enregistrer PDF"}
              {!saving && (
                <span style={{
                  borderLeft: "1px solid rgba(255,255,255,.4)",
                  paddingLeft: 6,
                  fontSize: 11,
                  opacity: 0.9,
                }}>▾</span>
              )}
            </button>

            {showFmtMenu && !saving && (
              <>
                {/* Overlay to close on outside click */}
                <div
                  style={{ position: "fixed", inset: 0, zIndex: 998 }}
                  onClick={() => setShowFmtMenu(false)}
                />
                <div style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  zIndex: 999,
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  boxShadow: "0 8px 24px rgba(0,0,0,.14)",
                  overflow: "hidden",
                  minWidth: 200,
                }}>
                  {/* Title */}
                  <div style={{
                    padding: "8px 14px 6px",
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    color: "#94a3b8",
                    borderBottom: "1px solid #f1f5f9",
                  }}>
                    Format de page
                  </div>

                  {/* Portrait */}
                  <button
                    onClick={() => savePdf("portrait")}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      width: "100%", padding: "10px 14px",
                      background: "none", border: "none",
                      cursor: "pointer", textAlign: "left",
                      borderBottom: "1px solid #f8fafc",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}
                  >
                    <span style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 24, height: 32, border: "1.5px solid #cbd5e1",
                      borderRadius: 3, background: "#f8fafc", flexShrink: 0,
                      fontSize: 8, color: "#64748b", fontWeight: 700,
                    }}>A4</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>Portrait</div>
                      <div style={{ fontSize: 10, color: "#94a3b8" }}>210 × 297 mm</div>
                    </div>
                  </button>

                  {/* Landscape */}
                  <button
                    onClick={() => savePdf("landscape")}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      width: "100%", padding: "10px 14px",
                      background: "none", border: "none",
                      cursor: "pointer", textAlign: "left",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}
                  >
                    <span style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 32, height: 24, border: "1.5px solid #cbd5e1",
                      borderRadius: 3, background: "#f8fafc", flexShrink: 0,
                      fontSize: 8, color: "#64748b", fontWeight: 700,
                    }}>A4</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>Paysage</div>
                      <div style={{ fontSize: 10, color: "#94a3b8" }}>297 × 210 mm</div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>

          <button className="toolbar-btn btn-close" onClick={() => window.close()}>
            ✕ Fermer
          </button>
        </div>
      </div>

      <div className="report-container" ref={containerRef}>

        {/* ══════════════════════════════════════════════════════════════════
            PAGE 1 — COUVERTURE
        ══════════════════════════════════════════════════════════════════ */}
        <div className="pdf-page">
          {/* Barre orange */}
          <div className="cover-top-stripe" />
          {/* Corps bicolonne */}
          <div className="cover-body">
            {/* Sidebar sombre */}
            <div className="cover-sidebar">
              <div>
                <div className="cover-sidebar-tag">Document confidentiel</div>
                <div className="cover-sidebar-rule" />
                <div className="cover-sidebar-prep">Rapport préparé par</div>
                <div className="cover-sidebar-name">{orgName}</div>
              </div>
              <div>
                <div className="cover-sidebar-status">
                  <div className="cover-sidebar-dot" style={{ background: f.netResult >= 0 ? "#10b981" : "#ef4444" }} />
                  <div className="cover-sidebar-status-text">{f.netResult >= 0 ? "Performance positive" : "Résultat déficitaire"}</div>
                </div>
                <div className="cover-sidebar-date">Généré le {generatedAt}</div>
              </div>
            </div>
            {/* Zone blanche */}
            <div className="cover-main">
              <div style={{ textAlign: "right" }}>
                <div className="cover-main-org">Organisation</div>
                <div className="cover-main-orgname">{orgName}</div>
              </div>
              <div className="cover-title-block">
                <div className="cover-rule" />
                <div className="cover-subtitle">Exercice fiscal {new Date(d.period.to).getFullYear()}</div>
                <div className="cover-title">Rapport<br /><span>de Gestion</span></div>
                <div className="cover-period">Période analysée : {periodLabel}</div>
              </div>
              <div className="cover-health">
                <div className="cover-health-label">Score de Santé Financière</div>
                <div className="cover-health-score" style={{ color: hsColor }}>{hs.score}%</div>
                <div className="cover-health-desc">{hsLabel}</div>
              </div>
            </div>
          </div>
          {/* KPI footer */}
          <div className="cover-footer">
            {[
              { lbl: "Produits",    val: compact(f.revenues) + " FCFA",      cls: "kpi-green" },
              { lbl: "Charges",     val: compact(f.expenses) + " FCFA",      cls: "kpi-red"   },
              { lbl: "Résultat net",val: compact(f.netResult) + " FCFA",     cls: f.netResult >= 0 ? "kpi-green" : "kpi-red" },
              { lbl: "Trésorerie",  val: compact(liq.cashPosition) + " FCFA",cls: liq.cashPosition >= 0 ? "kpi-blue" : "kpi-red" },
            ].map(k => (
              <div key={k.lbl} className="cover-kpi">
                <div className="cover-kpi-label">{k.lbl}</div>
                <div className={`cover-kpi-value ${k.cls}`}>{k.val}</div>
              </div>
            ))}
          </div>
          <PageFooter page={1} />
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            PAGE 2 — RÉSUMÉ EXÉCUTIF
        ══════════════════════════════════════════════════════════════════ */}
        <div className="pdf-page">
          <div className="page-header">
            <div className="page-header-left">
              <div className="page-num">2</div>
              <div>
                <div className="page-section-title">Résumé exécutif</div>
                <div className="h2">Vue d'ensemble dirigeants</div>
              </div>
            </div>
            <div className="caption">{periodLabel}</div>
          </div>
          <div className="page-content">
            {watchpoints.length > 0 && (
              <div className="alert-box" style={{ marginBottom: 16 }}>
                <div className="alert-box-header">
                  <span style={{ fontSize: 14 }}>⚠</span>
                  <div className="alert-box-title">{watchpoints.length} point{watchpoints.length > 1 ? "s" : ""} d'attention</div>
                </div>
                {watchpoints.map((w, i) => <div key={i} className="alert-item">{w}</div>)}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", border: "1px solid #f1f5f9", borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
              {[
                { tag: "Performance financière", bar: "bar-green", headline: `Produits : ${fcfa(f.revenues)} · Charges : ${fcfa(f.expenses)}`, body: `Le résultat net de la période s'établit à ${fcfa(f.netResult)} (marge : ${f.margin}%). ${revenueChg !== null ? `Les produits progressent de ${revenueChg >= 0 ? "+" : ""}${revenueChg}% vs la période N-1 (${fcfa(d.prev.revenues)}).` : ""}` },
                { tag: "Rentabilité", bar: f.operatingExpenseRatio < 80 ? "bar-green" : "bar-amber", headline: `Ratio charges/produits : ${f.operatingExpenseRatio}%`, body: `L'EBITDA s'élève à ${fcfa(f.ebitda)}. La marge brute est de ${f.grossMargin}%. Un ratio inférieur à 80% est considéré sain pour l'exploitation.` },
                { tag: "Liquidité", bar: liq.cashPosition >= 0 ? "bar-blue" : "bar-amber", headline: `Trésorerie : ${fcfa(liq.cashPosition)} · Fonds de roulement : ${fcfa(liq.workingCapital)}`, body: `Les créances clients s'élèvent à ${fcfa(liq.arOutstanding)} (DSO : ${liq.debtorsDays} jours). Les dettes fournisseurs sont de ${fcfa(liq.apOutstanding)} (DPO : ${liq.creditorsDays} jours).` },
                { tag: "Opérations", bar: "bar-blue", headline: `${ops.activeProjects} projet(s) actif(s) · ${ops.activeTasks} tâche(s) ouvertes`, body: `${ops.completedProjects} projet(s) clôturé(s) sur la période. ${ops.overdueProjects > 0 ? `⚠ ${ops.overdueProjects} projet(s) dépassent leur date de livraison.` : "Aucun projet ne dépasse la date de livraison."}` },
                { tag: "Ressources humaines", bar: "bar-green", headline: `Effectif actif : ${d.hr.activeCollab} collaborateur(s)`, body: `Répartition par type de contrat : ${Object.entries(d.hr.byContractType).map(([t, c]) => `${t} (${c})`).join(", ") || "Aucun contrat enregistré."}` },
              ].map(row => (
                <div key={row.tag} className="narrative-row">
                  <div className={`narrative-bar ${row.bar}`} />
                  <div className="narrative-content">
                    <div className="narrative-tag">{row.tag}</div>
                    <div className="narrative-headline">{row.headline}</div>
                    <div className="narrative-body">{row.body}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Recommandations */}
            <div className="info-box">
              <div className="h4" style={{ marginBottom: 8 }}>Recommandations automatiques</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {[
                  liq.arOverdue > 0 && `Prioriser le recouvrement de ${fcfa(liq.arOverdue)} de créances en retard — délai moyen constaté : ${liq.debtorsDays}j.`,
                  f.operatingExpenseRatio > 80 && `Réduire le ratio charges/produits de ${f.operatingExpenseRatio}% → cible < 80% (économies estimées : ${fcfa(Math.max(0, f.expenses - f.revenues * 0.8))}).`,
                  liq.apOverdue > 0 && `Régulariser ${fcfa(liq.apOverdue)} de dettes fournisseurs en retard pour préserver les relations.`,
                  ops.overdueProjects > 0 && `Réviser le plan de ${ops.overdueProjects} projet(s) en retard pour sécuriser la livraison.`,
                  liq.cashPosition < liq.apOutstanding * 0.5 && `Surveiller la position de trésorerie (${fcfa(liq.cashPosition)}) au regard des engagements fournisseurs.`,
                  !liq.arOverdue && !liq.apOverdue && f.netResult > 0 && "Situation financière globalement favorable. Maintenir la politique de recouvrement et surveiller le ratio charges/produits.",
                ].filter(Boolean).map((rec, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, fontSize: 11.5, color: "#475569", lineHeight: 1.5 }}>
                    <span style={{ flexShrink: 0, marginTop: 2, color: "#f97316", fontWeight: 700 }}>→</span>
                    <span>{rec as string}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <PageFooter page={2} />
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            PAGE 3 — CHIFFRES CLÉS
        ══════════════════════════════════════════════════════════════════ */}
        <div className="pdf-page">
          <div className="page-header">
            <div className="page-header-left">
              <div className="page-num">3</div>
              <div>
                <div className="page-section-title">Indicateurs de performance</div>
                <div className="h2">Chiffres Clés de la Période</div>
              </div>
            </div>
            <div className="caption">{periodLabel}</div>
          </div>
          <div className="page-content">
            <div className="kpi-grid" style={{ marginBottom: 20 }}>
              {[
                { lbl: "Produits totaux", val: fcfa(f.revenues), sub: revenueChg !== null ? `${revenueChg >= 0 ? "+" : ""}${revenueChg}% vs N-1` : "N-1 non disponible", accent: "kpi-accent-green" },
                { lbl: "Charges totales", val: fcfa(f.expenses), sub: expenseChg !== null ? `${expenseChg >= 0 ? "+" : ""}${expenseChg}% vs N-1` : "N-1 non disponible", accent: "kpi-accent-red" },
                { lbl: "Résultat net", val: fcfa(f.netResult), sub: netChg !== null ? `${netChg >= 0 ? "+" : ""}${netChg}% vs N-1` : "", accent: f.netResult >= 0 ? "kpi-accent-green" : "kpi-accent-red" },
                { lbl: "Marge nette", val: `${f.margin}%`, sub: `N-1 : ${d.prev.margin}%`, accent: f.margin >= 0 ? "kpi-accent-blue" : "kpi-accent-red" },
                { lbl: "Marge brute", val: `${f.grossMargin}%`, sub: "Sur produits totaux", accent: "kpi-accent-violet" },
                { lbl: "EBITDA", val: fcfa(f.ebitda), sub: "Bénéfice avant int. & amort.", accent: "kpi-accent-violet" },
                { lbl: "Trésorerie", val: fcfa(liq.cashPosition), sub: `FR : ${compact(liq.workingCapital)} FCFA`, accent: liq.cashPosition >= 0 ? "kpi-accent-blue" : "kpi-accent-red" },
                { lbl: "Créances clients", val: fcfa(liq.arOutstanding), sub: `Dont ${fcfa(liq.arOverdue)} en retard`, accent: "kpi-accent-amber" },
              ].map(k => (
                <div key={k.lbl} className={`kpi-card ${k.accent}`}>
                  <div className="kpi-card-lbl">{k.lbl}</div>
                  <div className="kpi-card-val">{k.val}</div>
                  <div className="kpi-card-sub">{k.sub}</div>
                </div>
              ))}
            </div>

            <hr className="section-divider" />
            <div className="section-label">Comparaison N-1 détaillée</div>
            <table className="pdf-table">
              <thead><tr>
                <th>Indicateur</th>
                <th className="right">Période actuelle</th>
                <th className="right">N-1</th>
                <th className="right">Variation</th>
                <th className="center">Tendance</th>
              </tr></thead>
              <tbody>
                {[
                  { label: "Produits",           curr: fcfa(f.revenues),   prev: fcfa(d.prev.revenues),   chg: revenueChg, up: true },
                  { label: "Charges",             curr: fcfa(f.expenses),   prev: fcfa(d.prev.expenses),   chg: expenseChg, up: false },
                  { label: "Résultat net",         curr: fcfa(f.netResult),  prev: fcfa(d.prev.netResult),  chg: netChg,     up: true },
                  { label: "Marge nette (%)",      curr: `${f.margin}%`,     prev: `${d.prev.margin}%`,     chg: f.margin - d.prev.margin, up: true },
                  { label: "Ratio C/P (%)",        curr: `${f.operatingExpenseRatio}%`, prev: `${oerPrev}%`, chg: f.operatingExpenseRatio - oerPrev, up: false },
                ].map(row => {
                  const isUp = row.chg !== null ? (row.up ? row.chg >= 0 : row.chg <= 0) : null;
                  return (
                    <tr key={row.label}>
                      <td className="bold">{row.label}</td>
                      <td className="right bold">{row.curr}</td>
                      <td className="right" style={{ color: "#94a3b8" }}>{row.prev}</td>
                      <td className={`right ${row.chg !== null ? (isUp ? "text-green" : "text-red") : ""}`}>
                        {row.chg !== null ? `${row.chg >= 0 ? "+" : ""}${Math.round(row.chg * 10) / 10}%` : "—"}
                      </td>
                      <td className="center">
                        {row.chg !== null ? (isUp ? "▲" : "▼") : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PageFooter page={3} />
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            PAGE 4 — SANTÉ FINANCIÈRE
        ══════════════════════════════════════════════════════════════════ */}
        <div className="pdf-page">
          <div className="page-header">
            <div className="page-header-left">
              <div className="page-num">4</div>
              <div>
                <div className="page-section-title">Analyse financière globale</div>
                <div className="h2">Santé Financière</div>
              </div>
            </div>
            <div className="caption">{periodLabel}</div>
          </div>
          <div className="page-content">
            {/* Score ring + checks */}
            <div className="health-ring-wrap" style={{ background: "#f8fafc", borderRadius: 10, padding: 16, border: "1px solid #e2e8f0", marginBottom: 18 }}>
              <div className="health-ring">
                <svg width="80" height="80" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="32" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                  <circle cx="40" cy="40" r="32" fill="none" stroke={hsColor} strokeWidth="8"
                    strokeDasharray={`${2 * Math.PI * 32 * hs.score / 100} ${2 * Math.PI * 32 * (1 - hs.score / 100)}`}
                    strokeLinecap="round" />
                </svg>
                <div className="health-ring-center">
                  <span className="ring-score" style={{ color: hsColor }}>{hs.score}%</span>
                  <span className="ring-label">SANTÉ</span>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 3 }}>{hsLabel}</div>
                <div style={{ fontSize: 11.5, color: "#64748b", marginBottom: 10 }}>{hs.achieved} / {hs.total} objectifs financiers atteints sur la période</div>
                <div className="health-checks">
                  {hs.checks.map((c, i) => (
                    <div key={i} className={`health-check-dot ${c.achieved ? "dot-ok" : "dot-nok"}`} title={c.label}>
                      {c.achieved ? "✓" : "✗"}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {["Croissance", "Rentabilité", "Liquidité", "Solvabilité"].map(cat => {
                  const catChecks = hs.checks.filter(c => c.cat === cat);
                  const ok = catChecks.filter(c => c.achieved).length;
                  const total = catChecks.length;
                  const pct = total > 0 ? Math.round((ok / total) * 100) : 0;
                  return (
                    <div key={cat} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, padding: "8px 10px", minWidth: 80 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#94a3b8", marginBottom: 4 }}>{cat}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: pct >= 70 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#ef4444" }}>{pct}%</div>
                      <div style={{ fontSize: 9.5, color: "#94a3b8" }}>{ok}/{total}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Health table */}
            <table className="pdf-table">
              <thead><tr>
                <th>Indicateur</th>
                <th className="right">Valeur</th>
                <th className="center">Cible</th>
                <th className="center">Statut</th>
                <th className="center">Importance</th>
              </tr></thead>
              <tbody>
                {["Croissance", "Rentabilité", "Liquidité", "Solvabilité"].map(cat => {
                  const rows = hs.checks.filter(c => c.cat === cat);
                  if (rows.length === 0) return null;
                  return [
                    <tr key={`cat-${cat}`} className="cat-row"><td colSpan={5}>{cat}</td></tr>,
                    ...rows.map((c, i) => {
                      const valFmt = c.isPercent ? `${c.curr}%` : c.isMoney ? fcfa(c.curr) : String(c.curr);
                      return (
                        <tr key={i}>
                          <td>{c.label}</td>
                          <td className="right bold">{valFmt}</td>
                          <td className="center" style={{ fontSize: 10, color: "#94a3b8" }}>{c.target}</td>
                          <td className="center">
                            <span className={`badge ${c.achieved ? "badge-green" : "badge-red"}`}>
                              {c.achieved ? "✓ Atteint" : "✗ Hors cible"}
                            </span>
                          </td>
                          <td className="center">
                            <span className={`badge ${c.importance === "Critique" ? "badge-red" : c.importance === "Élevé" ? "badge-amber" : c.importance === "Moyen" ? "badge-blue" : "badge-slate"}`}>
                              {c.importance}
                            </span>
                          </td>
                        </tr>
                      );
                    }),
                  ];
                })}
              </tbody>
            </table>
          </div>
          <PageFooter page={4} />
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            PAGE 5 — SEUIL DE RENTABILITÉ + PRODUITS VS CHARGES
        ══════════════════════════════════════════════════════════════════ */}
        <div className="pdf-page">
          <div className="page-header">
            <div className="page-header-left">
              <div className="page-num">5</div>
              <div>
                <div className="page-section-title">Analyse produits & charges</div>
                <div className="h2">Seuil de Rentabilité · Produits vs Charges</div>
              </div>
            </div>
            <div className="caption">{periodLabel}</div>
          </div>
          <div className="page-content">
            <div className="two-col" style={{ marginBottom: 20 }}>
              {/* Break-even summary */}
              <div>
                <div className="section-label">Seuil de rentabilité</div>
                <div className="kpi-grid kpi-grid-2" style={{ marginBottom: 10 }}>
                  {[
                    { lbl: "Seuil de rentabilité", val: be.bep !== null ? compact(be.bep) + " FCFA" : "N/A", accent: "kpi-accent-orange" },
                    { lbl: "Résultat d'exploitation", val: compact(be.operatingResult) + " FCFA", accent: be.operatingResult >= 0 ? "kpi-accent-green" : "kpi-accent-red" },
                    { lbl: "Charges fixes", val: compact(be.fixedCosts) + " FCFA", accent: "kpi-accent-amber" },
                    { lbl: "Charges variables", val: compact(be.variableCosts) + " FCFA", accent: "kpi-accent-blue" },
                  ].map(k => (
                    <div key={k.lbl} className={`kpi-card ${k.accent}`}>
                      <div className="kpi-card-lbl">{k.lbl}</div>
                      <div className="kpi-card-val" style={{ fontSize: 14 }}>{k.val}</div>
                    </div>
                  ))}
                </div>
                {/* Simple BEP bar visual */}
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>Visualisation</div>
                  {[
                    { label: "Produits", value: f.revenues, max: Math.max(f.revenues, be.bep ?? f.expenses, f.expenses), color: "#10b981" },
                    { label: "Seuil BEP", value: be.bep ?? f.expenses, max: Math.max(f.revenues, be.bep ?? f.expenses, f.expenses), color: "#f97316" },
                    { label: "Charges", value: f.expenses, max: Math.max(f.revenues, be.bep ?? f.expenses, f.expenses), color: "#ef4444" },
                  ].map(row => (
                    <div key={row.label} className="bar-row" style={{ marginBottom: 5 }}>
                      <div className="bar-label" style={{ width: 70, fontSize: 10 }}>{row.label}</div>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${Math.min((row.value / row.max) * 100, 100)}%`, background: row.color }} />
                      </div>
                      <div className="bar-value" style={{ fontSize: 9.5 }}>{compact(row.value)} FCFA</div>
                    </div>
                  ))}
                  <div style={{ marginTop: 8, fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>
                    {be.bep !== null && f.revenues >= be.bep
                      ? `✓ La période est bénéficiaire : CA dépasse le seuil de ${fcfa(f.revenues - be.bep)}.`
                      : be.bep !== null
                        ? `⚠ Il manque ${fcfa(be.bep - f.revenues)} pour atteindre l'équilibre.`
                        : "Seuil non calculable (pas de revenus enregistrés)."}
                  </div>
                </div>
              </div>

              {/* Monthly revenue vs expense */}
              {d.series.length > 0 && (
                <div>
                  <div className="section-label">Évolution mensuelle (Produits vs Charges)</div>
                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 14px", marginBottom: 10 }}>
                    <div className="monthly-chart">
                      {d.series.map(m => (
                        <div key={m.month} className="month-col">
                          <div className="month-bars">
                            <div className="month-bar" style={{ height: `${Math.round((m.revenues / maxBar) * 70)}px`, background: "#10b981", minHeight: 2 }} />
                            <div className="month-bar" style={{ height: `${Math.round((m.expenses / maxBar) * 70)}px`, background: "#f97316", minHeight: 2 }} />
                          </div>
                          <div className="month-label">{m.month.slice(0, 3)}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9.5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#10b981", display: "inline-block" }} /> Produits</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9.5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#f97316", display: "inline-block" }} /> Charges</div>
                    </div>
                  </div>
                  <table className="pdf-table" style={{ fontSize: 10.5 }}>
                    <thead><tr>
                      <th>Mois</th>
                      <th className="right">Produits</th>
                      <th className="right">Charges</th>
                      <th className="right">Résultat</th>
                    </tr></thead>
                    <tbody>
                      {d.series.map(m => (
                        <tr key={m.month}>
                          <td style={{ fontSize: 10.5 }}>{m.month}</td>
                          <td className="right text-green">{compact(m.revenues)}</td>
                          <td className="right" style={{ color: "#dc2626" }}>{compact(m.expenses)}</td>
                          <td className={`right ${m.netResult >= 0 ? "text-green" : "text-red"}`}>{compact(m.netResult)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
          <PageFooter page={5} />
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            PAGE 6 — CRÉANCES CLIENTS & RECOUVREMENT
        ══════════════════════════════════════════════════════════════════ */}
        <div className="pdf-page">
          <div className="page-header">
            <div className="page-header-left">
              <div className="page-num">6</div>
              <div>
                <div className="page-section-title">Créances & Recouvrement</div>
                <div className="h2">Balance Clients — Créances en cours</div>
              </div>
            </div>
            <div className="caption">{periodLabel}</div>
          </div>
          <div className="page-content">
            <div className="kpi-grid kpi-grid-3" style={{ marginBottom: 18 }}>
              {[
                { lbl: "Encours total (AR)", val: fcfa(liq.arOutstanding), accent: "kpi-accent-orange" },
                { lbl: "Dont en retard", val: fcfa(liq.arOverdue), accent: liq.arOverdue > 0 ? "kpi-accent-red" : "kpi-accent-green" },
                { lbl: "DSO (jours)", val: `${liq.debtorsDays}j`, accent: "kpi-accent-blue" },
              ].map(k => (
                <div key={k.lbl} className={`kpi-card ${k.accent}`}>
                  <div className="kpi-card-lbl">{k.lbl}</div>
                  <div className="kpi-card-val">{k.val}</div>
                </div>
              ))}
            </div>

            {d.topArClients.length > 0 ? (
              <>
                <div className="section-label" style={{ marginBottom: 8 }}>Top clients débiteurs</div>
                <table className="pdf-table">
                  <thead><tr>
                    <th>Client</th>
                    <th className="right">Encours</th>
                    <th className="right">En retard</th>
                    <th className="right">% Total</th>
                    <th>Exposition</th>
                  </tr></thead>
                  <tbody>
                    {d.topArClients.map(c => (
                      <tr key={c.name}>
                        <td className="bold">{c.name}</td>
                        <td className="right">{fcfa(c.outstanding)}</td>
                        <td className={`right ${c.overdue > 0 ? "text-red" : ""}`}>{c.overdue > 0 ? fcfa(c.overdue) : "—"}</td>
                        <td className="right">{c.percent}%</td>
                        <td style={{ width: 120, paddingRight: 16 }}>
                          <div className="progress-track">
                            <div className="progress-fill" style={{ width: `${Math.min(c.percent, 100)}%`, background: c.percent > 50 ? "#ef4444" : c.percent > 25 ? "#f59e0b" : "#10b981" }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <div className="info-box"><div className="body-text" style={{ textAlign: "center", color: "#94a3b8" }}>Aucune créance client en cours sur la période.</div></div>
            )}

            <hr className="section-divider" style={{ margin: "18px 0" }} />
            <div className="section-label">Recommandations de recouvrement</div>
            <div className="info-box">
              {liq.arOverdue > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 11.5, color: "#475569" }}>→ <strong>Priorité haute</strong> : relancer les clients présentant des créances en retard (total : {fcfa(liq.arOverdue)}).</div>
                  <div style={{ fontSize: 11.5, color: "#475569" }}>→ Vérifier les conditions de règlement contractuelles (délai moyen constaté : {liq.debtorsDays} jours).</div>
                  {liq.debtorsDays > 60 && <div style={{ fontSize: 11.5, color: "#dc2626" }}>→ <strong>Alerte</strong> : DSO &gt; 60 jours — risque de trésorerie à court terme.</div>}
                </div>
              ) : (
                <div style={{ fontSize: 11.5, color: "#10b981", fontWeight: 600 }}>✓ Aucune créance en retard. Situation de recouvrement satisfaisante.</div>
              )}
            </div>
          </div>
          <PageFooter page={6} />
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            PAGE 7 — FOURNISSEURS, CHARGES & TRÉSORERIE
        ══════════════════════════════════════════════════════════════════ */}
        <div className="pdf-page">
          <div className="page-header">
            <div className="page-header-left">
              <div className="page-num">7</div>
              <div>
                <div className="page-section-title">Fournisseurs · Charges · Trésorerie</div>
                <div className="h2">Analyse des Dépenses & Flux</div>
              </div>
            </div>
            <div className="caption">{periodLabel}</div>
          </div>
          <div className="page-content">
            <div className="two-col" style={{ marginBottom: 18 }}>
              <div>
                <div className="section-label">Balance fournisseurs (AP)</div>
                <div className="kpi-grid kpi-grid-3" style={{ marginBottom: 12 }}>
                  {[
                    { lbl: "Encours total (AP)", val: compact(liq.apOutstanding) + " FCFA", accent: "kpi-accent-amber" },
                    { lbl: "Dont en retard", val: compact(liq.apOverdue) + " FCFA", accent: liq.apOverdue > 0 ? "kpi-accent-red" : "kpi-accent-green" },
                    { lbl: "DPO (jours)", val: `${liq.creditorsDays}j`, accent: "kpi-accent-blue" },
                  ].map(k => (
                    <div key={k.lbl} className={`kpi-card ${k.accent}`}>
                      <div className="kpi-card-lbl">{k.lbl}</div>
                      <div className="kpi-card-val" style={{ fontSize: 13 }}>{k.val}</div>
                    </div>
                  ))}
                </div>
                {d.topApSuppliers.length > 0 ? (
                  <table className="pdf-table" style={{ fontSize: 10.5 }}>
                    <thead><tr>
                      <th>Fournisseur</th>
                      <th className="right">Encours</th>
                      <th className="right">En retard</th>
                      <th className="right">%</th>
                    </tr></thead>
                    <tbody>
                      {d.topApSuppliers.map(s => (
                        <tr key={s.name}>
                          <td className="bold" style={{ fontSize: 10.5 }}>{s.name}</td>
                          <td className="right">{compact(s.outstanding)}</td>
                          <td className={`right ${s.overdue > 0 ? "text-red" : ""}`}>{s.overdue > 0 ? compact(s.overdue) : "—"}</td>
                          <td className="right">{s.percent}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>Aucune dette fournisseur en cours.</div>
                )}
              </div>
              <div>
                <div className="section-label">Trésorerie & Flux</div>
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "14px 16px", marginBottom: 12 }}>
                  {[
                    { lbl: "Position de trésorerie", val: fcfa(liq.cashPosition), color: liq.cashPosition >= 0 ? "#10b981" : "#ef4444" },
                    { lbl: "Fonds de roulement", val: fcfa(liq.workingCapital), color: liq.workingCapital >= 0 ? "#10b981" : "#ef4444" },
                    { lbl: "Créances clients (AR)", val: fcfa(liq.arOutstanding), color: "#f97316" },
                    { lbl: "Dettes fournisseurs (AP)", val: fcfa(liq.apOutstanding), color: "#8b5cf6" },
                  ].map(row => (
                    <div key={row.lbl} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #f1f5f9", alignItems: "center" }}>
                      <div style={{ fontSize: 11.5, color: "#475569" }}>{row.lbl}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: row.color }}>{row.val}</div>
                    </div>
                  ))}
                </div>
                <div className="section-label">Ventilation des charges (Top comptes)</div>
                <div className="bar-chart">
                  {d.expenseBreakdown.slice(0, 6).map(e => (
                    <div key={e.code} className="bar-row">
                      <div className="bar-label" style={{ width: 95, fontSize: 9 }}>{e.label.slice(0, 18)}</div>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${Math.min((e.amount / maxExpAmt) * 100, 100)}%`, background: "#ef4444" }} />
                      </div>
                      <div className="bar-value" style={{ fontSize: 9 }}>{compact(e.amount)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <PageFooter page={7} />
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            PAGE 8 — OPÉRATIONS, RH & ANNEXES
        ══════════════════════════════════════════════════════════════════ */}
        <div className="pdf-page">
          <div className="page-header">
            <div className="page-header-left">
              <div className="page-num">8</div>
              <div>
                <div className="page-section-title">Opérations · RH · Annexes</div>
                <div className="h2">États Opérationnels & Méthodologie</div>
              </div>
            </div>
            <div className="caption">{periodLabel}</div>
          </div>
          <div className="page-content">
            <div className="two-col" style={{ marginBottom: 20 }}>
              {/* Opérations */}
              <div>
                <div className="section-label">Projets & Opérations</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { lbl: "Projets actifs", val: ops.activeProjects, accent: "#3b82f6" },
                    { lbl: "Projets clôturés", val: ops.completedProjects, accent: "#10b981" },
                    { lbl: "Projets en retard", val: ops.overdueProjects, accent: ops.overdueProjects > 0 ? "#ef4444" : "#10b981" },
                    { lbl: "Tâches ouvertes", val: ops.activeTasks, accent: "#f97316" },
                  ].map(row => (
                    <div key={row.lbl} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#f8fafc", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                      <div style={{ fontSize: 12, color: "#475569" }}>{row.lbl}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: row.accent }}>{row.val}</div>
                    </div>
                  ))}
                  {ops.avgProgress > 0 && (
                    <div style={{ padding: "10px 12px", background: "#f8fafc", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#475569", marginBottom: 5 }}>
                        <span>Avancement moyen</span><span style={{ fontWeight: 700 }}>{ops.avgProgress}%</span>
                      </div>
                      <div className="progress-track" style={{ height: 8 }}>
                        <div className="progress-fill" style={{ width: `${ops.avgProgress}%`, background: "#3b82f6" }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {/* RH */}
              <div>
                <div className="section-label">Ressources Humaines</div>
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "14px 16px", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 12 }}>
                    <span style={{ fontSize: 32, fontWeight: 900, color: "#0f172a" }}>{d.hr.activeCollab}</span>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>collaborateurs actifs</span>
                  </div>
                  {Object.entries(d.hr.byContractType).map(([type, count]) => (
                    <div key={type} style={{ marginBottom: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#475569", marginBottom: 3 }}>
                        <span>{type}</span>
                        <span style={{ fontWeight: 700 }}>{count} ({d.hr.activeCollab > 0 ? Math.round((count / d.hr.activeCollab) * 100) : 0}%)</span>
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${d.hr.activeCollab > 0 ? Math.round((count / d.hr.activeCollab) * 100) : 0}%`, background: "#f97316" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <hr className="section-divider" />
            <div className="section-label">Méthodologie & Notes</div>
            <div className="info-box">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 11, color: "#64748b", lineHeight: 1.6 }}>
                <div>
                  <div style={{ fontWeight: 700, color: "#334155", marginBottom: 3 }}>Sources de données</div>
                  Les données financières proviennent des écritures comptables du plan SYSCOHADA. Les chiffres N-1 correspondent à la même période de l'exercice précédent.
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: "#334155", marginBottom: 3 }}>Calculs clés</div>
                  DSO = Créances ÷ CA × 365. DPO = Dettes ÷ Charges × 365. BEP = Charges fixes ÷ Taux de marge sur coûts variables. Score de santé = % objectifs atteints sur 12 critères.
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: "#334155", marginBottom: 3 }}>Périmètre</div>
                  Période : {periodLabel}. Période N-1 : {fmtDate(d.prev.from)} – {fmtDate(d.prev.to)}. Devise : FCFA (XOF).
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: "#334155", marginBottom: 3 }}>Confidentialité</div>
                  Ce document est confidentiel. Il est destiné exclusivement à la Direction, au Conseil d'Administration et aux parties prenantes autorisées.
                </div>
              </div>
            </div>

            <div style={{ marginTop: 18, padding: "12px 14px", background: "#0f172a", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: "#fff", letterSpacing: "-0.5px" }}>{orgName}</div>
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.5)", textAlign: "center" }}>
                Rapport de Gestion · {periodLabel} · Généré le {generatedAt}
              </div>
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.4)", fontStyle: "italic" }}>Usage réservé à la Direction</div>
            </div>
          </div>
          <PageFooter page={8} />
        </div>

      </div>
    </>
  );
}
