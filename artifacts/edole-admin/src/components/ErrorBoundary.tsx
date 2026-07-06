import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isChunkError: boolean;
  reloadAttempted: boolean;
}

function isChunkLoadError(err: Error): boolean {
  return (
    err.name === "ChunkLoadError" ||
    /loading chunk \d+ failed/i.test(err.message) ||
    /failed to fetch dynamically imported module/i.test(err.message) ||
    /dynamically imported module/i.test(err.message) ||
    /importation de module dynamique/i.test(err.message)
  );
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, isChunkError: false, reloadAttempted: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      isChunkError: isChunkLoadError(error),
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Erreur React capturée :", error, info.componentStack);

    // ChunkLoadError → auto-reload une seule fois (déploiement mis à jour)
    if (isChunkLoadError(error) && !this.state.reloadAttempted) {
      this.setState({ reloadAttempted: true }, () => {
        window.location.reload();
      });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, isChunkError: false, reloadAttempted: false });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    const { error, isChunkError, reloadAttempted } = this.state;

    if (isChunkError && !reloadAttempted) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center min-h-[60vh] p-8">
        <div className="max-w-md w-full text-center bg-card border border-border rounded-xl p-10 shadow-lg">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>

          <h2 className="text-[18px] font-bold tracking-tight mb-2">
            {isChunkError ? "Mise à jour disponible" : "Une erreur est survenue"}
          </h2>

          <p className="text-muted-foreground text-sm leading-relaxed mb-6">
            {isChunkError
              ? "L'application a été mise à jour. Rechargez la page pour continuer."
              : "Une erreur est survenue lors du chargement de cette page. Veuillez réessayer ou revenir au tableau de bord."}
          </p>

          {import.meta.env.DEV && error && (
            <pre className="mb-4 text-left text-[11px] font-mono bg-muted rounded-lg px-3 py-2 text-destructive overflow-auto max-h-32">
              {error.message}
            </pre>
          )}

          <div className="flex gap-3 justify-center">
            <button
              onClick={isChunkError ? () => window.location.reload() : this.handleRetry}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              {isChunkError ? "Rafraîchir" : "Réessayer"}
            </button>
            <a
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-semibold hover:bg-secondary/80 transition-colors"
            >
              <Home className="w-4 h-4" />
              Tableau de bord
            </a>
          </div>
        </div>
      </div>
    );
  }
}

/**
 * HOC pratique pour wrapper un composant lazy dans un ErrorBoundary + Suspense.
 * Usage : <SafeSuspense><MonPageLazy /></SafeSuspense>
 */
export function SafeSuspense({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const spinner = (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
  return (
    <ErrorBoundary>
      <React.Suspense fallback={fallback ?? spinner}>
        {children}
      </React.Suspense>
    </ErrorBoundary>
  );
}

/**
 * Error boundary au niveau applicatif global (utilisé dans main.tsx).
 * Affiche une UI de crash complète si tout le contexte React est détruit.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, isChunkError: false, reloadAttempted: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error, isChunkError: isChunkLoadError(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AppErrorBoundary] Erreur critique :", error, info.componentStack);
    if (isChunkLoadError(error) && !this.state.reloadAttempted) {
      this.setState({ reloadAttempted: true }, () => window.location.reload());
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const { isChunkError, error } = this.state;

    if (isChunkError && !this.state.reloadAttempted) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-[22px] font-bold tracking-tight mb-3">
            {isChunkError ? "Mise à jour disponible" : "L'application a rencontré un problème"}
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed mb-8">
            {isChunkError
              ? "Une nouvelle version de Gameasu est disponible. Rechargez la page pour continuer."
              : "Une erreur inattendue s'est produite. Rechargez la page ou revenez au tableau de bord."}
          </p>
          {import.meta.env.DEV && error && (
            <pre className="mb-6 text-left text-[11px] font-mono bg-muted rounded-lg px-3 py-2 text-destructive overflow-auto max-h-40">
              {error.message}
            </pre>
          )}
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> Rafraîchir
            </button>
            <a
              href="/"
              onClick={() => this.setState({ hasError: false, error: null, isChunkError: false, reloadAttempted: false })}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-semibold hover:bg-secondary/80 transition-colors"
            >
              <Home className="w-4 h-4" /> Accueil
            </a>
          </div>
        </div>
      </div>
    );
  }
}
