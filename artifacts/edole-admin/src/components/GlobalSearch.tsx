import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { apiFetch } from "@/lib/api";
import {
  Search, X, Building2, FolderKanban, CheckSquare, Target, FileText,
  ShoppingCart, FileSignature, Wrench, ClipboardCheck, Users, FileIcon,
  ArrowRight, Clock, Loader2, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  url: string;
  score: number;
}
interface SearchGroup {
  key: string;
  label: string;
  icon: string;
  results: SearchResult[];
}
interface SearchResponse {
  q: string;
  total: number;
  groups: SearchGroup[];
}

const GROUP_ICONS: Record<string, React.ElementType> = {
  clients:       Building2,
  projects:      FolderKanban,
  tasks:         CheckSquare,
  opportunities: Target,
  invoices:      FileText,
  orders:        ShoppingCart,
  proformas:     FileSignature,
  equipment:     Wrench,
  rentals:       ClipboardCheck,
  collaborators: Users,
  documents:     FileIcon,
};

const GROUP_COLORS: Record<string, string> = {
  clients:       "text-blue-500 bg-blue-50",
  projects:      "text-amber-500 bg-amber-50",
  tasks:         "text-violet-500 bg-violet-50",
  opportunities: "text-emerald-500 bg-emerald-50",
  invoices:      "text-orange-500 bg-orange-50",
  orders:        "text-cyan-500 bg-cyan-50",
  proformas:     "text-teal-500 bg-teal-50",
  equipment:     "text-muted-foreground bg-muted",
  rentals:       "text-pink-500 bg-pink-50",
  collaborators: "text-indigo-500 bg-indigo-50",
  documents:     "text-gray-500 bg-gray-100",
};

const RECENT_KEY = "gameasuSearch_recent";
const MAX_RECENT = 6;

function getRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
}
function addRecent(q: string) {
  const prev = getRecent().filter((x) => x !== q);
  localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...prev].slice(0, MAX_RECENT)));
}

function hl(text: string, q: string) {
  if (!q || q.length < 2) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-amber-200/80 text-amber-900 rounded-sm px-0.5">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setData(null);
      setSelected(0);
      setRecent(getRecent());
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.trim().length < 2) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await apiFetch<SearchResponse>(`/api/search?q=${encodeURIComponent(query.trim())}&limit=6`);
        setData(res);
        setSelected(0);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const allResults: Array<SearchResult & { groupKey: string; groupLabel: string }> = (data?.groups ?? []).flatMap((g) =>
    g.results.map((r) => ({ ...r, groupKey: g.key, groupLabel: g.label })),
  );

  const goTo = useCallback((url: string, q?: string) => {
    if (q) addRecent(q);
    onClose();
    setQuery("");
    setData(null);
    navigate(url);
  }, [navigate, onClose]);

  useEffect(() => {
    if (!open) return;
    const down = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, allResults.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      } else if (e.key === "Enter" && allResults[selected]) {
        goTo(allResults[selected].url, query);
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [open, allResults, selected, goTo, query, onClose]);

  if (!open) return null;

  const showRecent = !query && recent.length > 0;
  const showEmpty = query.trim().length >= 2 && !loading && (!data || data.total === 0);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] px-4"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Palette */}
      <div className="relative w-full max-w-2xl bg-card rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/60">
          {loading
            ? <Loader2 className="w-5 h-5 text-muted-foreground shrink-0 animate-spin" />
            : <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          }
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher clients, projets, factures, équipements…"
            className="flex-1 bg-transparent outline-none text-[15px] text-foreground placeholder:text-muted-foreground/60"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button onClick={() => { setQuery(""); setData(null); inputRef.current?.focus(); }}
              className="p-1 rounded-md hover:bg-muted text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex text-[11px] font-mono text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5 shrink-0">
            Échap
          </kbd>
        </div>

        {/* Body */}
        <div className="overflow-y-auto max-h-[60vh]">
          {/* Recent searches */}
          {showRecent && (
            <div className="px-4 pt-3 pb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Clock className="w-3 h-3" />Recherches récentes
              </p>
              <div className="space-y-0.5">
                {recent.map((r) => (
                  <button
                    key={r}
                    onClick={() => setQuery(r)}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl hover:bg-muted/60 text-left group"
                  >
                    <Clock className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                    <span className="text-sm text-foreground/80 flex-1 truncate">{r}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/40 transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick links (no query, no recent) */}
          {!query && !showRecent && (
            <div className="px-4 pt-3 pb-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Accès rapide</p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: "Clients", url: "/clients", icon: Building2, color: "text-blue-500 bg-blue-50" },
                  { label: "Projets", url: "/projets", icon: FolderKanban, color: "text-amber-500 bg-amber-50" },
                  { label: "Factures", url: "/factures", icon: FileText, color: "text-orange-500 bg-orange-50" },
                  { label: "Tâches", url: "/tasks", icon: CheckSquare, color: "text-violet-500 bg-violet-50" },
                  { label: "Équipements", url: "/equipements", icon: Wrench, color: "text-muted-foreground bg-muted" },
                  { label: "Collaborateurs", url: "/collaborateurs", icon: Users, color: "text-indigo-500 bg-indigo-50" },
                ].map((item) => (
                  <button
                    key={item.url}
                    onClick={() => goTo(item.url)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-muted/60 text-left group transition-colors"
                  >
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", item.color)}>
                      <item.icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm font-medium text-foreground/80">{item.label}</span>
                    <ChevronRight className="w-3.5 h-3.5 ml-auto text-muted-foreground/0 group-hover:text-muted-foreground/40 transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {data && data.groups.length > 0 && (() => {
            let globalIdx = 0;
            return (
              <div className="py-2">
                {data.groups.map((group) => {
                  const GroupIcon = GROUP_ICONS[group.key] ?? FileIcon;
                  const color = GROUP_COLORS[group.key] ?? "text-gray-500 bg-gray-100";
                  return (
                    <div key={group.key} className="mb-1">
                      <div className="flex items-center gap-2 px-4 py-1.5">
                        <div className={cn("w-5 h-5 rounded flex items-center justify-center shrink-0", color)}>
                          <GroupIcon className="w-3 h-3" />
                        </div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {group.label}
                        </p>
                        <span className="text-[10px] text-muted-foreground/60 ml-auto">{group.results.length}</span>
                      </div>
                      <div>
                        {group.results.map((result) => {
                          const idx = globalIdx++;
                          const isSelected = idx === selected;
                          return (
                            <button
                              key={result.id}
                              onClick={() => goTo(result.url, query.trim())}
                              onMouseEnter={() => setSelected(idx)}
                              className={cn(
                                "flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors",
                                isSelected ? "bg-muted/70" : "hover:bg-muted/40",
                              )}
                            >
                              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", color)}>
                                <GroupIcon className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {hl(result.title, query.trim())}
                                </p>
                                {result.subtitle && (
                                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                    {result.subtitle}
                                  </p>
                                )}
                              </div>
                              {isSelected && <ArrowRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Empty state */}
          {showEmpty && (
            <div className="py-12 text-center">
              <Search className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Aucun résultat pour <strong className="text-foreground">"{query}"</strong></p>
              <p className="text-xs text-muted-foreground/70 mt-1">Vérifiez l'orthographe ou essayez d'autres mots-clés.</p>
            </div>
          )}

          {/* Hint — minimum chars */}
          {query && query.trim().length === 1 && (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">Continuez à taper pour lancer la recherche…</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {(data?.total ?? 0) > 0 && (
          <div className="border-t border-border/50 px-4 py-2 flex items-center justify-between text-[11px] text-muted-foreground bg-muted/20">
            <span>{data?.total} résultat{(data?.total ?? 0) > 1 ? "s" : ""}</span>
            <span className="flex items-center gap-2">
              <kbd className="font-mono bg-background border border-border rounded px-1 py-0.5">↑↓</kbd>
              naviguer ·
              <kbd className="font-mono bg-background border border-border rounded px-1 py-0.5">↵</kbd>
              ouvrir
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function useGlobalSearch() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (isCtrlOrCmd && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen(true);
      }
      if (isCtrlOrCmd && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return { open, setOpen };
}
