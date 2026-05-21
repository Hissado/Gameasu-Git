import { Suspense, lazy } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Layout } from "@/components/Layout";
import { RouteModuleGate } from "@/components/RouteModuleGate";
import { CallCenterProvider } from "@/components/CallCenter";
import { GlobalNotifications } from "@/components/GlobalNotifications";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import Dashboard from "@/pages/dashboard";

// ── Lazy-loaded pages (un chunk par route → premier paint quasi-instantané) ──
const ProjectsList = lazy(() => import("@/pages/projects/index"));
const ProjectDetail = lazy(() => import("@/pages/projects/detail"));
const ServicesIndex = lazy(() => import("@/pages/services/index"));
const ServiceDetail = lazy(() => import("@/pages/services/detail"));
const ClientsWorkspace = lazy(() => import("@/pages/clients/index"));
const ClientWorkspaceDetail = lazy(() => import("@/pages/clients/detail"));
const TasksList = lazy(() => import("@/pages/tasks/index"));
const TaskDetail = lazy(() => import("@/pages/tasks/detail"));
const CrmHome = lazy(() => import("@/pages/crm/index"));
const ClientsList = lazy(() => import("@/pages/crm/clients/index"));
const ClientDetail = lazy(() => import("@/pages/crm/clients/detail"));
const ActivitiesList = lazy(() => import("@/pages/crm/activities/index"));
const EquipmentList = lazy(() => import("@/pages/equipment/index"));
const EquipmentCategories = lazy(() => import("@/pages/equipment/categories/index"));
const EquipmentQRCodes = lazy(() => import("@/pages/equipment/qr"));
const ReportsPage = lazy(() => import("@/pages/reports/index"));
const MapPage = lazy(() => import("@/pages/map/index"));
const InspectionCompare = lazy(() => import("@/pages/inspections/compare"));
const CollaboratorsList = lazy(() => import("@/pages/collaborators/index"));
const CollaboratorDetail = lazy(() => import("@/pages/collaborators/detail"));
const RentalsList = lazy(() => import("@/pages/rentals/index"));
const RentalDetail = lazy(() => import("@/pages/rentals/detail"));
const InspectionsList = lazy(() => import("@/pages/inspections/index"));
const LogisticsList = lazy(() => import("@/pages/logistics/index"));
const ProformasList = lazy(() => import("@/pages/proformas/index"));
const OrdersList = lazy(() => import("@/pages/orders/index"));
const InvoicesList = lazy(() => import("@/pages/invoices/index"));
const PaymentsList = lazy(() => import("@/pages/payments/index"));
const Messaging = lazy(() => import("@/pages/messaging/index"));
const CallsList = lazy(() => import("@/pages/calls/index"));
const UsersList = lazy(() => import("@/pages/users/index"));
const NotificationsList = lazy(() => import("@/pages/notifications/index"));
const Settings = lazy(() => import("@/pages/settings/index"));
const AccountingDashboard = lazy(() => import("@/pages/accounting/index"));
const AccountingChart = lazy(() => import("@/pages/accounting/chart-of-accounts"));
const AccountingEntries = lazy(() => import("@/pages/accounting/entries"));
const AccountingLedger = lazy(() => import("@/pages/accounting/ledger"));
const AccountingBalance = lazy(() => import("@/pages/accounting/balance"));
const AccountingIncome = lazy(() => import("@/pages/accounting/income-statement"));
const AccountingBalanceSheet = lazy(() => import("@/pages/accounting/balance-sheet"));
const AccountingCustomers = lazy(() => import("@/pages/accounting/customers"));
const AccountingSuppliers = lazy(() => import("@/pages/accounting/suppliers"));
const AccountingBanks = lazy(() => import("@/pages/accounting/banks"));
const AccountingFixedAssets = lazy(() => import("@/pages/accounting/fixed-assets"));
const HrDashboard = lazy(() => import("@/pages/hr/index"));
const HrDepartments = lazy(() => import("@/pages/hr/departments"));
const HrPositions = lazy(() => import("@/pages/hr/positions"));
const HrContracts = lazy(() => import("@/pages/hr/contracts"));
const HrDocuments = lazy(() => import("@/pages/hr/documents"));
const HrAssignments = lazy(() => import("@/pages/hr/assignments"));
const CommercialClients = lazy(() => import("@/pages/commercial/clients"));
const CommercialServices = lazy(() => import("@/pages/commercial/services"));
const SalesScoring = lazy(() => import("@/pages/sales/scoring"));
const TasksFocus = lazy(() => import("@/pages/tasks/Focus"));
const DocumentsIntelligence = lazy(() => import("@/pages/documents/intelligence"));
const MarketingDashboard = lazy(() => import("@/pages/marketing/index"));
const MarketingProspects = lazy(() => import("@/pages/marketing/prospects"));
const MarketingCampaigns = lazy(() => import("@/pages/marketing/campaigns"));
const MarketingAudiences = lazy(() => import("@/pages/marketing/audiences"));
const MarketingTemplates = lazy(() => import("@/pages/marketing/templates"));
const MarketingAutomations = lazy(() => import("@/pages/marketing/automations"));
const MarketingAlerts = lazy(() => import("@/pages/marketing/alerts"));
const MarketingContacts = lazy(() => import("@/pages/marketing/contacts"));
const MarketingCalendar = lazy(() => import("@/pages/marketing/calendar"));
const MarketingAnalytics = lazy(() => import("@/pages/marketing/analytics"));
const MarketingConsent = lazy(() => import("@/pages/marketing/consent"));
const MarketingChannels = lazy(() => import("@/pages/marketing/channels"));
const MarketingForms = lazy(() => import("@/pages/marketing/forms"));
const DocumentsPage = lazy(() => import("@/pages/documents/index"));
const AlertsPage = lazy(() => import("@/pages/alerts/index"));
const TicketsPage = lazy(() => import("@/pages/tickets/index"));
const FpaDashboard = lazy(() => import("@/pages/fpa/index"));
const FpaBudgets = lazy(() => import("@/pages/fpa/budgets"));
const FpaBudgetDetail = lazy(() => import("@/pages/fpa/budget-detail"));
const FpaVariance = lazy(() => import("@/pages/fpa/variance"));
const FpaForecast = lazy(() => import("@/pages/fpa/forecast"));
const FpaReports = lazy(() => import("@/pages/fpa/reports"));
const AdminHub = lazy(() => import("@/pages/admin/index"));
const AdminRoles = lazy(() => import("@/pages/admin/roles"));
const AdminPermissions = lazy(() => import("@/pages/admin/permissions"));
const AdminDepartments = lazy(() => import("@/pages/admin/departments"));
const AdminUsers = lazy(() => import("@/pages/admin/users"));
const AdminInvitations = lazy(() => import("@/pages/admin/invitations"));
const AdminAudit = lazy(() => import("@/pages/admin/audit"));
const ChangePassword = lazy(() => import("@/pages/change-password"));
const AcceptInvitation = lazy(() => import("@/pages/accept-invitation"));
const BillingPage = lazy(() => import("@/pages/billing"));
const WorkspaceSettingsPage = lazy(() => import("@/pages/workspace-settings"));
const UpgradeRequiredPage = lazy(() => import("@/pages/upgrade-required"));
const IntelligenceCenter = lazy(() => import("@/pages/intelligence/index"));
const AutomationsPage = lazy(() => import("@/pages/automations/index"));
const AttendancePage = lazy(() => import("@/pages/attendance/index"));

// ── Cache global réglé pour confort + fraîcheur raisonnable ────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 30 * 1000,        // 30s : données considérées fraîches
      gcTime: 5 * 60 * 1000,       // 5min : conservation cache mémoire
    },
    mutations: {
      retry: 0,
    },
  },
});

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/accept-invitation">
        <Suspense fallback={<PageFallback />}><AcceptInvitation /></Suspense>
      </Route>
      <Route>
        <ProtectedRoute>
          <CallCenterProvider>
          <GlobalNotifications />
          <Layout>
            <Suspense fallback={<PageFallback />}>
              <RouteModuleGate>
              <Switch>
                <Route path="/" component={Dashboard} />

                <Route path="/clients" component={ClientsWorkspace} />
                <Route path="/clients/:id" component={ClientWorkspaceDetail} />

                <Route path="/services" component={ServicesIndex} />
                <Route path="/services/:id" component={ServiceDetail} />

                <Route path="/projects" component={ProjectsList} />
                <Route path="/projects/:id" component={ProjectDetail} />

                <Route path="/tasks" component={TasksList} />
                <Route path="/tasks/:id" component={TaskDetail} />

                <Route path="/crm" component={CrmHome} />
                <Route path="/crm/clients" component={ClientsList} />
                <Route path="/crm/clients/:id" component={ClientDetail} />
                <Route path="/crm/activities" component={ActivitiesList} />

                <Route path="/equipment" component={EquipmentList} />
                <Route path="/equipment/categories" component={EquipmentCategories} />
                <Route path="/equipment/qr" component={EquipmentQRCodes} />
                <Route path="/reports" component={ReportsPage} />
                <Route path="/map" component={MapPage} />
                <Route path="/inspections/compare/:rentalId" component={InspectionCompare} />

                <Route path="/collaborators" component={CollaboratorsList} />
                <Route path="/collaborators/:id" component={CollaboratorDetail} />

                <Route path="/rentals" component={RentalsList} />
                <Route path="/rentals/:id" component={RentalDetail} />
                <Route path="/inspections" component={InspectionsList} />
                <Route path="/logistics" component={LogisticsList} />

                <Route path="/orders" component={OrdersList} />
                <Route path="/proformas" component={ProformasList} />
                <Route path="/invoices" component={InvoicesList} />
                <Route path="/payments" component={PaymentsList} />

                <Route path="/messaging" component={Messaging} />
                <Route path="/calls" component={CallsList} />
                <Route path="/users" component={UsersList} />
                <Route path="/notifications" component={NotificationsList} />
                <Route path="/settings" component={Settings} />

                <Route path="/fpa" component={FpaDashboard} />
                <Route path="/fpa/budgets" component={FpaBudgets} />
                <Route path="/fpa/budgets/:id" component={FpaBudgetDetail} />
                <Route path="/fpa/variance" component={FpaVariance} />
                <Route path="/fpa/forecast" component={FpaForecast} />
                <Route path="/fpa/reports" component={FpaReports} />

                <Route path="/accounting" component={AccountingDashboard} />
                <Route path="/accounting/chart-of-accounts" component={AccountingChart} />
                <Route path="/accounting/entries" component={AccountingEntries} />
                <Route path="/accounting/ledger" component={AccountingLedger} />
                <Route path="/accounting/balance" component={AccountingBalance} />
                <Route path="/accounting/income-statement" component={AccountingIncome} />
                <Route path="/accounting/balance-sheet" component={AccountingBalanceSheet} />
                <Route path="/accounting/customers" component={AccountingCustomers} />
                <Route path="/accounting/suppliers" component={AccountingSuppliers} />
                <Route path="/accounting/banks" component={AccountingBanks} />
                <Route path="/accounting/fixed-assets" component={AccountingFixedAssets} />

                <Route path="/hr" component={HrDashboard} />
                <Route path="/hr/departments" component={HrDepartments} />
                <Route path="/hr/positions" component={HrPositions} />
                <Route path="/hr/contracts" component={HrContracts} />
                <Route path="/hr/documents" component={HrDocuments} />
                <Route path="/hr/assignments" component={HrAssignments} />

                <Route path="/commercial/clients" component={CommercialClients} />
                <Route path="/commercial/services" component={CommercialServices} />
                <Route path="/sales/scoring" component={SalesScoring} />
                <Route path="/tasks/focus" component={TasksFocus} />
                <Route path="/documents/intelligence" component={DocumentsIntelligence} />

                <Route path="/marketing" component={MarketingDashboard} />
                <Route path="/marketing/campaigns" component={MarketingCampaigns} />
                <Route path="/marketing/audiences" component={MarketingAudiences} />
                <Route path="/marketing/templates" component={MarketingTemplates} />
                <Route path="/marketing/automations" component={MarketingAutomations} />
                <Route path="/marketing/alerts" component={MarketingAlerts} />
                <Route path="/marketing/contacts" component={MarketingContacts} />
                <Route path="/marketing/calendar" component={MarketingCalendar} />
                <Route path="/marketing/analytics" component={MarketingAnalytics} />
                <Route path="/marketing/consent" component={MarketingConsent} />
                <Route path="/marketing/channels" component={MarketingChannels} />
                <Route path="/marketing/forms" component={MarketingForms} />
                <Route path="/marketing/prospects" component={MarketingProspects} />

                <Route path="/documents" component={DocumentsPage} />
                <Route path="/alerts" component={AlertsPage} />
                <Route path="/tickets" component={TicketsPage} />
                <Route path="/intelligence" component={IntelligenceCenter} />
                <Route path="/automations" component={AutomationsPage} />
                <Route path="/attendance" component={AttendancePage} />

                <Route path="/admin" component={AdminHub} />
                <Route path="/admin/roles" component={AdminRoles} />
                <Route path="/admin/permissions" component={AdminPermissions} />
                <Route path="/admin/departments" component={AdminDepartments} />
                <Route path="/admin/users" component={AdminUsers} />
                <Route path="/admin/invitations" component={AdminInvitations} />
                <Route path="/admin/audit" component={AdminAudit} />
                <Route path="/change-password" component={ChangePassword} />

                <Route path="/billing" component={BillingPage} />
                <Route path="/workspace-settings" component={WorkspaceSettingsPage} />
                <Route path="/upgrade-required" component={UpgradeRequiredPage} />

                <Route component={NotFound} />
              </Switch>
              </RouteModuleGate>
            </Suspense>
          </Layout>
          </CallCenterProvider>
        </ProtectedRoute>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <AppRouter />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
