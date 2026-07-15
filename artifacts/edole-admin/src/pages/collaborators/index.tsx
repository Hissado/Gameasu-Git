import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ReadOnlyBanner } from "@/components/ui/read-only-banner";
import { useLocation, useSearch } from "wouter";
import { useDebounce } from "@/lib/use-debounce";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Search, UserPlus, X, ArrowUpDown, User, Keyboard } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";
import { FieldTooltip, FieldHint } from "@/components/ui/field-tooltip";
import { useModuleTour, WelcomeModal, OnboardingTour, TOUR_PATHS } from "@/components/ui/onboarding-tour";

// ─── Constants ────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#0d9488","#0284c7","#7c3aed","#db2777","#d97706",
  "#16a34a","#dc2626","#9333ea","#0891b2","#65a30d",
];

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getCollabStatus(c: any): { label: string; className: string } | null {
  if (c.contractExpiresInDays != null && c.contractExpiresInDays <= 30) {
    return {
      label: c.contractExpiresInDays === 0 ? "Expire aujourd'hui" : `Expire dans ${c.contractExpiresInDays}j`,
      className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    };
  }
  if (c.employmentStatus === "inactive") {
    return { label: "Inactif", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
  }
  if (!c.isAvailable) {
    return { label: "Indisponible", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
  }
  if (c.hireDate) {
    const daysAgo = (Date.now() - new Date(c.hireDate).getTime()) / 86_400_000;
    if (daysAgo < 90) {
      return { label: "Nouveau", className: "bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary" };
    }
  }
  return null;
}

type SortKey = "name_asc" | "name_desc" | "hire_desc" | "hire_asc" | "workload_desc";
type StatusFilter = "all" | "active" | "inactive" | "new" | "unavailable";

// ─── Main Component ────────────────────────────────────────────────────────────

const COLLABS_TOUR = [
  { target: "collab-header", title: "Annuaire des collaborateurs", description: "Gérez les profils, disponibilités et affectations de toute votre équipe." },
  { target: "collab-search", title: "Recherche & filtres", description: "Filtrez par nom, département et statut. Raccourcis clavier : / pour chercher, ↑↓ pour naviguer, Entrée pour ouvrir un profil." },
  { target: "collab-list", title: "Liste de l'équipe", description: "Cliquez sur un collaborateur pour accéder à son profil complet : contrat, compétences, historique de présence et bulletin de paie." },
];

export default function CollaboratorsList() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ── All filters are stored in the URL so they survive navigation ──
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);

  const sort = (searchParams.get("sort") ?? "name_asc") as SortKey;
  const statusFilter = (searchParams.get("status") ?? "all") as StatusFilter;
  const deptFilter = searchParams.get("dept") ?? "all";
  const searchFromUrl = searchParams.get("search") ?? "";

  // Local state for the search input (smooth typing); debounced value writes to URL
  const [searchInput, setSearchInput] = useState(searchFromUrl);
  const debouncedSearch = useDebounce(searchInput, 300);

  // Sync search input when URL changes externally (e.g. back/forward)
  useEffect(() => {
    setSearchInput(searchFromUrl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchFromUrl]);

  // Helper: navigate with updated params, preserving all other params
  const updateParams = useCallback((updates: Record<string, string | null>) => {
    const p = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "" || value === "all" || (key === "sort" && value === "name_asc")) {
        p.delete(key);
      } else {
        p.set(key, value);
      }
    }
    const qs = p.toString();
    navigate(`/collaborateurs${qs ? `?${qs}` : ""}`, { replace: true });
  }, [navigate]);

  // Write debounced search to URL
  useEffect(() => {
    updateParams({ search: debouncedSearch });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const setSort = useCallback((value: SortKey) => {
    updateParams({ sort: value });
  }, [updateParams]);

  const setStatusFilter = useCallback((value: StatusFilter) => {
    updateParams({ status: value });
  }, [updateParams]);

  const setDeptFilter = useCallback((value: string) => {
    updateParams({ dept: value });
  }, [updateParams]);

  // The search value used for filtering is the debounced one
  const search = debouncedSearch;

  // ── Keyboard focused index (-1 = none) ──
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // ── Refs ──
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ── Add dialog ──
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    employmentStatus: "active", hireDate: "", departmentId: "", positionId: "",
  });

  const isManagerOrAbove = user?.role === "admin" || user?.role === "manager" || user?.role === "super_admin";

  // ── Data ──
  const { data: allCollabsData, isLoading } = useQuery<{ data: any[] }>({
    queryKey: ["collab-list", user?.id],
    queryFn: () => apiFetch("/api/collaborators?limit=500"),
    staleTime: 60_000,
  });

  const { data: deptData } = useQuery<{ data: any[] }>({
    queryKey: ["departments-list"],
    queryFn: () => apiFetch("/api/hr/departments?limit=200"),
    staleTime: 120_000,
  });

  const { data: positionData } = useQuery<{ data: any[] }>({
    queryKey: ["positions-list"],
    queryFn: () => apiFetch("/api/hr/positions?limit=200"),
    staleTime: 120_000,
  });

  const allCollabs = allCollabsData?.data ?? [];
  const { showWelcome, tourActive, startTour, startTourWithPath, dismissWelcome, closeTour, selectedPathKey, handleTourStepChange, tourInitialStep, tourPathLabel } = useModuleTour("collaborateurs", !isLoading && allCollabs.length === 0);
  const activeSteps = TOUR_PATHS["collaborateurs"]?.find(p => p.key === selectedPathKey)?.steps ?? COLLABS_TOUR;

  const statusCounts = useMemo(() => {
    const now = Date.now();
    let active = 0, inactive = 0, newCollab = 0, unavailable = 0;
    for (const c of allCollabs) {
      const daysAgo = c.hireDate ? (now - new Date(c.hireDate).getTime()) / 86_400_000 : Infinity;
      if (c.employmentStatus !== "active") inactive++;
      else if (!c.isAvailable) unavailable++;
      else if (daysAgo < 90) newCollab++;
      else active++;
    }
    return { active, inactive, new: newCollab, unavailable };
  }, [allCollabs]);

  const departments = useMemo(() => {
    return Array.from(
      new Map(
        allCollabs
          .filter((c: any) => c.departmentId && c.department)
          .map((c: any) => [c.departmentId, c.department as string])
      ).entries()
    ).map(([id, name]) => ({ id, name }));
  }, [allCollabs]);

  const filtered = useMemo(() => {
    let arr = allCollabs.filter((c: any) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const match = [c.firstName, c.lastName, c.position, c.department, c.email]
          .some((v: string | null) => v?.toLowerCase().includes(q));
        if (!match) return false;
      }
      if (deptFilter !== "all" && c.departmentId !== deptFilter) return false;
      if (statusFilter !== "all") {
        if (statusFilter === "inactive" && c.employmentStatus === "active") return false;
        if (statusFilter === "unavailable" && (c.isAvailable || c.employmentStatus !== "active")) return false;
        if (statusFilter === "new") {
          if (!c.hireDate) return false;
          const daysAgo = (Date.now() - new Date(c.hireDate).getTime()) / 86_400_000;
          if (daysAgo >= 90 || c.employmentStatus !== "active" || !c.isAvailable) return false;
        }
        if (statusFilter === "active") {
          if (c.employmentStatus !== "active" || !c.isAvailable) return false;
          if (c.hireDate) {
            const daysAgo = (Date.now() - new Date(c.hireDate).getTime()) / 86_400_000;
            if (daysAgo < 90) return false;
          }
        }
      }
      return true;
    });

    switch (sort) {
      case "name_desc":
        arr.sort((a: any, b: any) => `${b.lastName} ${b.firstName}`.localeCompare(`${a.lastName} ${a.firstName}`, "fr"));
        break;
      case "hire_desc":
        arr.sort((a: any, b: any) => {
          const da = a.hireDate ? new Date(a.hireDate).getTime() : 0;
          const db = b.hireDate ? new Date(b.hireDate).getTime() : 0;
          return db - da;
        });
        break;
      case "hire_asc":
        arr.sort((a: any, b: any) => {
          const da = a.hireDate ? new Date(a.hireDate).getTime() : Infinity;
          const db = b.hireDate ? new Date(b.hireDate).getTime() : Infinity;
          return da - db;
        });
        break;
      case "workload_desc":
        arr.sort((a: any, b: any) => (b.activeTasks || 0) - (a.activeTasks || 0));
        break;
      default:
        arr.sort((a: any, b: any) =>
          `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "fr"));
    }
    return arr;
  }, [allCollabs, search, deptFilter, statusFilter, sort]);

  // Reset focused index when filtered list changes
  useEffect(() => {
    setFocusedIndex(-1);
  }, [search, deptFilter, statusFilter, sort]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex < 0 || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-focused-index="${focusedIndex}"]`);
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusedIndex]);

  // ── Keyboard navigation ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isInInput = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable;

      // ↑ / ↓ — move through list
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !isInInput) {
        e.preventDefault();
        setFocusedIndex(prev => {
          if (e.key === "ArrowDown") {
            return prev < filtered.length - 1 ? prev + 1 : prev;
          } else {
            return prev > 0 ? prev - 1 : 0;
          }
        });
        return;
      }

      // Enter — open focused collaborator
      if (e.key === "Enter" && !isInInput) {
        if (focusedIndex >= 0 && focusedIndex < filtered.length) {
          e.preventDefault();
          navigate(`/collaborateurs/${filtered[focusedIndex].id}${searchString ? `?${searchString}` : ""}`);
        }
        return;
      }

      // Escape — clear search or lose focus from input
      if (e.key === "Escape" && isInInput && e.target === searchInputRef.current) {
        e.preventDefault();
        setSearchInput("");
        searchInputRef.current?.blur();
        return;
      }

      // / or Ctrl+K — focus search
      if ((e.ctrlKey && e.key === "k") || (!isInInput && e.key === "/")) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filtered, focusedIndex, navigate]);

  // ── Add collaborator mutation ──
  const addMutation = useMutation({
    mutationFn: (data: typeof addForm) =>
      apiFetch("/api/collaborators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast.success("Collaborateur ajouté");
      queryClient.invalidateQueries({ queryKey: ["collab-list"] });
      setAddOpen(false);
      setAddForm({ firstName: "", lastName: "", email: "", phone: "", employmentStatus: "active", hireDate: "", departmentId: "", positionId: "" });
    },
    onError: () => toast.error("Erreur lors de l'ajout"),
  });

  const resetFilters = useCallback(() => {
    setSearchInput("");
    navigate("/collaborateurs", { replace: true });
  }, [navigate]);

  const hasFilters = search || statusFilter !== "all" || deptFilter !== "all" || sort !== "name_asc";

  // ── Render ──
  return (
    <div className="space-y-5">
      <ReadOnlyBanner />
      {showWelcome && (
        <WelcomeModal
          title="Collaborateurs"
          subtitle="Découvrez comment gérer les profils et l'annuaire de votre équipe."
          icon={User}
          steps={activeSteps}
          paths={TOUR_PATHS["collaborateurs"]}
          onStartPath={startTourWithPath}
          onStart={startTour}
          onDismiss={dismissWelcome}
        />
      )}
      {tourActive && (
        <OnboardingTour
          steps={activeSteps}
          onClose={closeTour}
          pathLabel={tourPathLabel}
          initialStep={tourInitialStep}
          onStepChange={handleTourStepChange}
        />
      )}

      {/* ── Page header ── */}
      <div data-tour="collab-header" className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Collaborateurs</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isLoading ? "Chargement…" : `${allCollabs.length} collaborateur${allCollabs.length !== 1 ? "s" : ""} au total`}
          </p>
        </div>
        {isManagerOrAbove && (
          <Button
            size="sm"
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
            onClick={() => setAddOpen(true)}
          >
            <UserPlus className="w-4 h-4" />
            Ajouter
          </Button>
        )}
      </div>

      {/* ── Search + filters ── */}
      <div data-tour="collab-search" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchInputRef}
            placeholder="Rechercher un collaborateur… (/ ou Ctrl+K)"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="pl-9 h-9 text-sm bg-muted/40"
          />
          {searchInput && (
            <button
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearchInput("")}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Status chips */}
        <div className="flex gap-1.5 flex-wrap">
          {([
            { value: "all", label: "Tous", count: allCollabs.length },
            { value: "active", label: "Actif", count: statusCounts.active },
            { value: "inactive", label: "Inactif", count: statusCounts.inactive },
            { value: "new", label: "Nouveau", count: statusCounts.new },
            { value: "unavailable", label: "Indispo.", count: statusCounts.unavailable },
          ] as const).map(({ value, label, count }) => {
            const isActive = statusFilter === value;
            const isEmpty = value !== "all" && count === 0;
            return (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                disabled={isEmpty}
                className={`text-xs font-medium px-3 py-1 rounded-full border transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : isEmpty
                    ? "bg-muted/30 text-muted-foreground/40 border-border/40 cursor-not-allowed"
                    : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                {label} ({count})
              </button>
            );
          })}
        </div>

        {/* Department + sort row */}
        <div className="flex gap-2 flex-wrap items-center">
          {departments.length > 0 && (
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="h-8 text-xs w-52 bg-muted/40 border-border">
                <SelectValue placeholder="Tous les départements" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les départements</SelectItem>
                {departments.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="h-8 text-xs w-52 bg-muted/40 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name_asc">Nom A → Z</SelectItem>
                <SelectItem value="name_desc">Nom Z → A</SelectItem>
                <SelectItem value="hire_desc">Embauche : récent → ancien</SelectItem>
                <SelectItem value="hire_asc">Embauche : ancien → récent</SelectItem>
                <SelectItem value="workload_desc">Charge : élevée → faible</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {hasFilters && (
            <button
              className="text-xs text-primary hover:underline ml-auto"
              onClick={resetFilters}
            >
              Réinitialiser
            </button>
          )}

          <span className="text-xs text-muted-foreground ml-auto">
            {filtered.length} résultat{filtered.length !== 1 ? "s" : ""}
            {focusedIndex >= 0 && (
              <span className="ml-2 text-primary font-medium">
                · {focusedIndex + 1}/{filtered.length} sélectionné
              </span>
            )}
          </span>
        </div>
      </div>

      {/* ── List ── */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3.5">
              <Skeleton className="w-10 h-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={User}
          title={hasFilters ? "Aucun collaborateur ne correspond aux filtres" : "Aucun collaborateur enregistré"}
          description={!hasFilters ? "Ajoutez les membres de votre équipe pour gérer leurs contrats, tâches et présences." : undefined}
          actionLabel={hasFilters ? "Réinitialiser les filtres" : "Ajouter un collaborateur"}
          onAction={hasFilters ? resetFilters : () => setAddOpen(true)}
          actionIcon={hasFilters ? null : undefined}
          className="py-16"
        />
      ) : (
        <div
          data-tour="collab-list"
          ref={listRef}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden"
        >
          {filtered.map((c: any, index: number) => {
            const status = getCollabStatus(c);
            const initials = `${c.firstName?.[0] ?? ""}${c.lastName?.[0] ?? ""}`.toUpperCase();
            const isFocused = index === focusedIndex;

            return (
              <div
                key={c.id}
                data-focused-index={index}
                onClick={() => navigate(`/collaborateurs/${c.id}${searchString ? `?${searchString}` : ""}`)}
                className={cn(
                  "flex items-center gap-3 px-5 py-3.5 cursor-pointer transition-all duration-100",
                  "border-l-2",
                  isFocused
                    ? "bg-primary/5 border-l-primary dark:bg-primary/10"
                    : "border-l-transparent hover:bg-slate-50",
                )}
              >
                <Avatar className="w-10 h-10 shrink-0">
                  {c.avatarUrl && <AvatarImage src={c.avatarUrl} />}
                  <AvatarFallback
                    className="text-sm font-semibold text-white"
                    style={{ backgroundColor: getAvatarColor(c.id) }}
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm font-semibold truncate leading-tight",
                    isFocused ? "text-primary dark:text-primary" : "text-slate-800",
                  )}>
                    {c.firstName} {c.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {c.position || c.department || "Poste non renseigné"}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {c.department && (
                    <span className="hidden sm:inline text-xs text-slate-400 font-medium truncate max-w-[120px]">
                      {c.department}
                    </span>
                  )}
                  {status ? (
                    <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full", status.className)}>
                      {status.label}
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      Actif
                    </span>
                  )}
                  {isFocused && (
                    <kbd className="hidden sm:inline-flex items-center text-[10px] px-1.5 py-px rounded border border-primary/30 bg-primary/10 text-primary font-mono font-bold">
                      ↵
                    </kbd>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Keyboard shortcut hints ── */}
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground/60 px-1">
        <span className="flex items-center gap-1">
          <Keyboard className="w-3 h-3" />
          Raccourcis :
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-px rounded bg-muted border border-border font-mono">↑</kbd>
          <kbd className="px-1 py-px rounded bg-muted border border-border font-mono">↓</kbd>
          naviguer
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-px rounded bg-muted border border-border font-mono">↵</kbd>
          ouvrir
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-px rounded bg-muted border border-border font-mono">/</kbd>
          rechercher
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-px rounded bg-muted border border-border font-mono">Esc</kbd>
          effacer
        </span>
      </div>

      {/* ── Add collaborator dialog ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un collaborateur</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Prénom *</Label>
                <Input
                  value={addForm.firstName}
                  onChange={e => setAddForm(f => ({ ...f, firstName: e.target.value }))}
                  placeholder="Prénom"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Nom *</Label>
                <Input
                  value={addForm.lastName}
                  onChange={e => setAddForm(f => ({ ...f, lastName: e.target.value }))}
                  placeholder="Nom de famille"
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Label className="text-xs">E-mail</Label>
                <FieldTooltip content="Adresse email professionnelle utilisée pour les notifications, les accès au portail RH et les communications internes." />
              </div>
              <Input
                type="email"
                value={addForm.email}
                onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                placeholder="email@example.com"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Label className="text-xs">Téléphone</Label>
                <FieldTooltip content="Numéro de téléphone professionnel. Utilisé pour les urgences, les notifications SMS et les appels depuis l'application." />
              </div>
              <Input
                value={addForm.phone}
                onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+228 00 00 00 00"
                className="h-8 text-sm"
              />
              <FieldHint>Format international recommandé : +228 XX XX XX XX</FieldHint>
            </div>
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Label className="text-xs">Date d'embauche</Label>
                <FieldTooltip content="Date officielle d'entrée en poste. Sert au calcul de l'ancienneté, de la période d'essai (90 jours) et des droits aux congés annuels." />
              </div>
              <Input
                type="date"
                value={addForm.hireDate}
                onChange={e => setAddForm(f => ({ ...f, hireDate: e.target.value }))}
                className="h-8 text-sm"
              />
              <FieldHint>Détermine l'ancienneté et le calcul des congés.</FieldHint>
            </div>
            {deptData?.data && deptData.data.length > 0 && (
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <Label className="text-xs">Département</Label>
                  <FieldTooltip content="Service ou unité organisationnelle de rattachement. Permet le regroupement dans les rapports RH et les matrices de charge." />
                </div>
                <Select value={addForm.departmentId} onValueChange={v => setAddForm(f => ({ ...f, departmentId: v }))}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Choisir un département" />
                  </SelectTrigger>
                  <SelectContent>
                    {deptData.data.map((d: any) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {positionData?.data && positionData.data.length > 0 && (
              <div>
                <Label className="text-xs mb-1 block">Poste</Label>
                <Select value={addForm.positionId} onValueChange={v => setAddForm(f => ({ ...f, positionId: v }))}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Choisir un poste" />
                  </SelectTrigger>
                  <SelectContent>
                    {positionData.data.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Annuler</Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={!addForm.firstName || !addForm.lastName || addMutation.isPending}
              onClick={() => addMutation.mutate(addForm)}
            >
              {addMutation.isPending ? "Ajout…" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
