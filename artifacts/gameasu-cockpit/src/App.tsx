import { lazy, Suspense, useEffect, Component, type ReactNode } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { AuthProvider, useAuth } from "@/lib/auth";
import Layout from "@/components/Layout";

/* ── Lazy import avec rechargement automatique si chunk introuvable (cache périmé) ── */
function lazyWithRetry<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      return await importFn();
    } catch {
      /* Le chunk n'existe plus (déploiement récent) → rechargement forcé */
      window.location.reload();
      return new Promise(() => {}) as never;
    }
  });
}

const LoginPage               = lazyWithRetry(() => import("@/pages/login"));
const ResetPasswordPage       = lazyWithRetry(() => import("@/pages/reset-password"));
const DashboardPage           = lazyWithRetry(() => import("@/pages/dashboard"));
const TenantsPage             = lazyWithRetry(() => import("@/pages/tenants"));
const TenantDetail            = lazyWithRetry(() => import("@/pages/tenants/detail"));
const SubscriptionsPage       = lazyWithRetry(() => import("@/pages/subscriptions"));
const TicketsPage             = lazyWithRetry(() => import("@/pages/tickets"));
const IncidentsPage           = lazyWithRetry(() => import("@/pages/incidents"));
const AuditPage               = lazyWithRetry(() => import("@/pages/audit"));
const MonitoringPage          = lazyWithRetry(() => import("@/pages/monitoring"));
const CustomAppsPage          = lazyWithRetry(() => import("@/pages/custom-apps"));
const ReportsPage             = lazyWithRetry(() => import("@/pages/reports"));
const UsersPage               = lazyWithRetry(() => import("@/pages/users"));
const ProfilePage             = lazyWithRetry(() => import("@/pages/profile"));
const EmailsPage              = lazyWithRetry(() => import("@/pages/emails"));
const ExpertFirmsPage         = lazyWithRetry(() => import("@/pages/expert-firms"));
const AccessRequestsPage      = lazyWithRetry(() => import("@/pages/access-requests"));
const PaymentDeclarationsPage = lazyWithRetry(() => import("@/pages/payment-declarations"));
const PartnersPage            = lazyWithRetry(() => import("@/pages/partners"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 2 * 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

/* ── Error boundary : capture les crash React et propose un rechargement ── */
type EBState = { hasError: boolean; isChunkError: boolean; errorMessage: string };
class AppErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, isChunkError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): EBState {
    const msg = error?.message ?? "";
    const stack = error?.stack ?? "";
    const isChunk =
      msg.includes("Failed to fetch dynamically imported module") ||
      msg.includes("Loading chunk") ||
      msg.includes("Importing a module script failed") ||
      msg.includes("error loading dynamically imported module");
    return {
      hasError: true,
      isChunkError: isChunk,
      errorMessage: isChunk ? "" : `${msg}\n\n${stack.split("\n").slice(0, 8).join("\n")}`,
    };
  }

  componentDidCatch(error: Error) {
    console.error("[Cockpit] AppErrorBoundary caught:", error);
    if (this.state.isChunkError) {
      /* Cache périmé après déploiement → rechargement automatique */
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError && !this.state.isChunkError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-8">
          <div className="max-w-lg w-full text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Une erreur inattendue s'est produite</h2>
            <p className="text-sm text-muted-foreground">
              Le Cockpit a rencontré un problème. Rechargez la page pour réessayer.
            </p>
            {this.state.errorMessage && (
              <pre className="text-left text-xs bg-red-50 border border-red-200 rounded-lg p-3 overflow-auto max-h-48 text-red-800 whitespace-pre-wrap">
                {this.state.errorMessage}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <RefreshCw className="w-4 h-4" />
              Recharger la page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  useEffect(() => {
    if (!isLoading && !user) navigate("/login");
  }, [isLoading, user, navigate]);
  if (isLoading || !user) return <Spinner />;
  return <Layout>{children}</Layout>;
}

function AppRouter() {
  return (
    <Suspense fallback={<Spinner />}>
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route path="/">
          <ProtectedRoute><DashboardPage /></ProtectedRoute>
        </Route>
        <Route path="/tenants/:id">
          {() => <ProtectedRoute><TenantDetail /></ProtectedRoute>}
        </Route>
        <Route path="/tenants">
          <ProtectedRoute><TenantsPage /></ProtectedRoute>
        </Route>
        <Route path="/subscriptions">
          <ProtectedRoute><SubscriptionsPage /></ProtectedRoute>
        </Route>
        <Route path="/reports">
          <ProtectedRoute><ReportsPage /></ProtectedRoute>
        </Route>
        <Route path="/tickets">
          <ProtectedRoute><TicketsPage /></ProtectedRoute>
        </Route>
        <Route path="/incidents">
          <ProtectedRoute><IncidentsPage /></ProtectedRoute>
        </Route>
        <Route path="/monitoring">
          <ProtectedRoute><MonitoringPage /></ProtectedRoute>
        </Route>
        <Route path="/emails">
          <ProtectedRoute><EmailsPage /></ProtectedRoute>
        </Route>
        <Route path="/custom-apps">
          <ProtectedRoute><CustomAppsPage /></ProtectedRoute>
        </Route>
        <Route path="/users">
          <ProtectedRoute><UsersPage /></ProtectedRoute>
        </Route>
        <Route path="/profile">
          <ProtectedRoute><ProfilePage /></ProtectedRoute>
        </Route>
        <Route path="/expert-firms">
          <ProtectedRoute><ExpertFirmsPage /></ProtectedRoute>
        </Route>
        <Route path="/access-requests">
          <ProtectedRoute><AccessRequestsPage /></ProtectedRoute>
        </Route>
        <Route path="/payment-declarations">
          <ProtectedRoute><PaymentDeclarationsPage /></ProtectedRoute>
        </Route>
        <Route path="/partners">
          <ProtectedRoute><PartnersPage /></ProtectedRoute>
        </Route>
        <Route path="/audit">
          <ProtectedRoute><AuditPage /></ProtectedRoute>
        </Route>
        <Route>
          <ProtectedRoute><DashboardPage /></ProtectedRoute>
        </Route>
      </Switch>
    </Suspense>
  );
}

export default function App() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={base}>
              <AppRouter />
            </WouterRouter>
            <Toaster />
            <SonnerToaster richColors position="top-right" />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
