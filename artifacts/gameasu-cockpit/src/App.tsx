import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "@/lib/auth";
import Layout from "@/components/Layout";

const LoginPage      = lazy(() => import("@/pages/login"));
const DashboardPage  = lazy(() => import("@/pages/dashboard"));
const TenantsPage    = lazy(() => import("@/pages/tenants"));
const TenantDetail   = lazy(() => import("@/pages/tenants/detail"));
const TicketsPage    = lazy(() => import("@/pages/tickets"));
const IncidentsPage  = lazy(() => import("@/pages/incidents"));
const AuditPage      = lazy(() => import("@/pages/audit"));
const MonitoringPage  = lazy(() => import("@/pages/monitoring"));
const CustomAppsPage  = lazy(() => import("@/pages/custom-apps"));
const ReportsPage    = lazy(() => import("@/pages/reports"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  useEffect(() => {
    if (!isLoading && !user) navigate("/login");
  }, [isLoading, user, navigate]);
  if (isLoading) return <Spinner />;
  if (!user) return null;
  return <Layout>{children}</Layout>;
}

function AppRouter() {
  return (
    <Suspense fallback={<Spinner />}>
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/">
          <ProtectedRoute><DashboardPage /></ProtectedRoute>
        </Route>
        <Route path="/tenants/:id">
          {(p) => <ProtectedRoute><TenantDetail /></ProtectedRoute>}
        </Route>
        <Route path="/tenants">
          <ProtectedRoute><TenantsPage /></ProtectedRoute>
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
        <Route path="/audit">
          <ProtectedRoute><AuditPage /></ProtectedRoute>
        </Route>
        <Route path="/monitoring">
          <ProtectedRoute><MonitoringPage /></ProtectedRoute>
        </Route>
        <Route path="/custom-apps">
          <ProtectedRoute><CustomAppsPage /></ProtectedRoute>
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
  );
}
