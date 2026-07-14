import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X, ChevronRight, ChevronLeft, Sparkles, BookOpen, MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface TourStep {
  target: string;
  title: string;
  description: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

export const TOUR_MODULE_MAP: Record<string, string> = {
  "/": "dashboard",
  "/crm": "crm",
  "/projets": "projets",
  "/collaborateurs": "collaborateurs",
  "/comptabilite/plan-comptable": "plan_comptable",
  "/fpa": "fpa",
  "/taches": "taches",
  "/factures": "factures",
  "/paiements": "paiements",
  "/locations": "locations",
};

const LS_KEY = (k: string) => `tour_seen_${k}`;
export const RELAUNCH_EVENT = "gameasu:relaunch-tour";

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useModuleTour(moduleKey: string, canAutoShow = false) {
  const [showWelcome, setShowWelcome] = useState(false);
  const [tourActive, setTourActive] = useState(false);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    if (canAutoShow && !localStorage.getItem(LS_KEY(moduleKey))) {
      t = setTimeout(() => setShowWelcome(true), 600);
    }
    return () => { if (t !== undefined) clearTimeout(t); };
  }, [moduleKey, canAutoShow]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail === moduleKey) {
        localStorage.removeItem(LS_KEY(moduleKey));
        setTourActive(false);
        setTimeout(() => setShowWelcome(true), 100);
      }
    };
    window.addEventListener(RELAUNCH_EVENT, handler);
    return () => window.removeEventListener(RELAUNCH_EVENT, handler);
  }, [moduleKey]);

  const startTour = useCallback(() => {
    localStorage.setItem(LS_KEY(moduleKey), "1");
    setShowWelcome(false);
    setTourActive(true);
  }, [moduleKey]);

  const dismissWelcome = useCallback(() => {
    localStorage.setItem(LS_KEY(moduleKey), "1");
    setShowWelcome(false);
  }, [moduleKey]);

  const closeTour = useCallback(() => setTourActive(false), []);

  return { showWelcome, tourActive, startTour, dismissWelcome, closeTour };
}

// ─── WelcomeModal ──────────────────────────────────────────────────────────────

interface WelcomeModalProps {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  steps: TourStep[];
  onStart: () => void;
  onDismiss: () => void;
}

export function WelcomeModal({ title, subtitle, icon: Icon, steps, onStart, onDismiss }: WelcomeModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onDismiss]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss(); }}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header gradient */}
        <div className="bg-gradient-to-br from-[#0F1A3A] to-[#162040] px-6 pt-6 pb-5 text-white">
          <button
            onClick={onDismiss}
            className="absolute top-4 right-4 text-white/40 hover:text-white/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-primary/80 text-[10px] font-bold uppercase tracking-wider mb-0.5">
                <Sparkles className="w-3 h-3" />
                Visite guidée
              </div>
              <h2 className="text-lg font-bold leading-tight">{title}</h2>
            </div>
          </div>
          <p className="text-sm text-white/60 mt-1">{subtitle}</p>
        </div>

        {/* Steps preview */}
        <div className="px-6 py-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Au programme ({steps.length} étapes)
          </p>
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li key={s.target} className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm text-slate-700 leading-snug">
                  <span className="font-medium">{s.title}</span>
                  {" "}
                  <span className="text-muted-foreground">— {s.description}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <Button variant="outline" size="sm" className="flex-1" onClick={onDismiss}>
            Ignorer
          </Button>
          <Button size="sm" className="flex-1 gap-1.5 bg-primary hover:bg-primary/90" onClick={onStart}>
            <BookOpen className="w-4 h-4" />
            Démarrer la visite
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── OnboardingTour (spotlight overlay) ───────────────────────────────────────

interface OnboardingTourProps {
  steps: TourStep[];
  onClose: () => void;
}

const LENS_PADDING = 8;
const BUBBLE_GAP = 16;
const BUBBLE_WIDTH = 320;

function getBubblePosition(rect: DOMRect, bubbleHeight: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const spaceBelow = vh - (rect.bottom + LENS_PADDING);
  const spaceAbove = rect.top - LENS_PADDING;

  let top: number;
  let placement: "top" | "bottom";

  if (spaceBelow >= bubbleHeight + BUBBLE_GAP) {
    top = rect.bottom + LENS_PADDING + BUBBLE_GAP;
    placement = "bottom";
  } else if (spaceAbove >= bubbleHeight + BUBBLE_GAP) {
    top = rect.top - LENS_PADDING - BUBBLE_GAP - bubbleHeight;
    placement = "top";
  } else {
    top = rect.bottom + LENS_PADDING + BUBBLE_GAP;
    placement = "bottom";
  }

  const lensCenter = rect.left + rect.width / 2;
  let left = lensCenter - BUBBLE_WIDTH / 2;
  left = Math.max(12, Math.min(left, vw - BUBBLE_WIDTH - 12));

  return { top, left, placement };
}

export function OnboardingTour({ steps, onClose }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const updateRect = useCallback((stepIdx: number) => {
    const step = steps[stepIdx];
    if (!step) return;
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const measure = () => {
      const r = el.getBoundingClientRect();
      setRect(r);
    };
    const tid = setTimeout(measure, 350);
    return () => clearTimeout(tid);
  }, [steps]);

  useEffect(() => {
    const cleanup = updateRect(currentStep);
    return cleanup;
  }, [currentStep, updateRect]);

  useEffect(() => {
    const handleResize = () => updateRect(currentStep);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [currentStep, updateRect]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if ((e.key === "ArrowRight" || e.key === "ArrowDown") && currentStep < steps.length - 1) {
        setCurrentStep(s => s + 1);
      }
      if ((e.key === "ArrowLeft" || e.key === "ArrowUp") && currentStep > 0) {
        setCurrentStep(s => s - 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentStep, steps.length, onClose]);

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const isFirst = currentStep === 0;

  const lensStyle: React.CSSProperties = rect ? {
    position: "fixed",
    top: rect.top - LENS_PADDING,
    left: rect.left - LENS_PADDING,
    width: rect.width + LENS_PADDING * 2,
    height: rect.height + LENS_PADDING * 2,
    boxShadow: "0 0 0 9999px rgba(0,0,0,0.65)",
    borderRadius: 10,
    zIndex: 9995,
    pointerEvents: "none",
    transition: "top 0.25s ease, left 0.25s ease, width 0.25s ease, height 0.25s ease",
    outline: "2px solid rgba(243,112,33,0.7)",
    outlineOffset: 0,
  } : {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.65)",
    zIndex: 9995,
    pointerEvents: "none",
  };

  const BUBBLE_HEIGHT_ESTIMATE = 180;
  const bubblePos = rect
    ? getBubblePosition(rect, BUBBLE_HEIGHT_ESTIMATE)
    : { top: window.innerHeight / 2 - BUBBLE_HEIGHT_ESTIMATE / 2, left: window.innerWidth / 2 - BUBBLE_WIDTH / 2, placement: "bottom" as const };

  const bubbleStyle: React.CSSProperties = {
    position: "fixed",
    top: bubblePos.top,
    left: bubblePos.left,
    width: BUBBLE_WIDTH,
    zIndex: 9999,
    transition: "top 0.25s ease, left 0.25s ease",
  };

  return createPortal(
    <>
      {/* Lens (spotlight) */}
      <div style={lensStyle} />

      {/* Bubble */}
      <div style={bubbleStyle}>
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-200">
          {/* Progress bar */}
          <div className="h-1 bg-slate-100">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>

          <div className="px-4 pt-4 pb-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
                  {currentStep + 1}
                </span>
                <h3 className="text-sm font-bold text-slate-900">{step.title}</h3>
              </div>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-slate-700 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-4 gap-2">
              <span className="text-[11px] text-muted-foreground font-medium">
                {currentStep + 1} / {steps.length}
              </span>
              <div className="flex gap-2">
                {!isFirst && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-xs gap-1"
                    onClick={() => setCurrentStep(s => s - 1)}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Préc.
                  </Button>
                )}
                {isLast ? (
                  <Button
                    size="sm"
                    className="h-7 px-3 text-xs gap-1 bg-primary hover:bg-primary/90"
                    onClick={onClose}
                  >
                    Terminer
                    <MapPin className="w-3.5 h-3.5" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="h-7 px-2.5 text-xs gap-1 bg-primary hover:bg-primary/90"
                    onClick={() => setCurrentStep(s => s + 1)}
                  >
                    Suivant
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Dot indicators */}
          <div className="flex justify-center gap-1.5 pb-3">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  i === currentStep ? "bg-primary w-4" : "bg-slate-200 hover:bg-slate-300"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
