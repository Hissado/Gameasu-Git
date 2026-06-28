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
const TasksHub = lazy(() => import("@/pages/tasks/_wrapper"));
const TaskDetail = lazy(() => import("@/pages/tasks/detail"));
const CrmHub = lazy(() => import("@/pages/crm/_wrapper"));
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
const CollaboratorBadgePrint = lazy(() => import("@/pages/collaborators/badge"));
const RentalsList = lazy(() => import("@/pages/rentals/index"));
const RentalDetail = lazy(() => import("@/pages/rentals/detail"));
const InspectionsList = lazy(() => import("@/pages/inspections/index"));
const LogisticsList = lazy(() => import("@/pages/logistics/index"));
const PricingCalculator = lazy(() => import("@/pages/pricing/index"));
const ProformasList = lazy(() => import("@/pages/proformas/index"));
const OrdersList = lazy(() => import("@/pages/orders/index"));
const InvoicesList = lazy(() => import("@/pages/invoices/index"));
const PaymentsList = lazy(() => import("@/pages/payments/index"));
const CreditNotesList = lazy(() => import("@/pages/credit-notes/index"));
const PrintDocument = lazy(() => import("@/pages/documents/print"));
const Messaging = lazy(() => import("@/pages/messaging/index"));
const CallsList = lazy(() => import("@/pages/calls/index"));
const UsersList = lazy(() => import("@/pages/users/index"));
const NotificationsList = lazy(() => import("@/pages/notifications/index"));
const Settings = lazy(() => import("@/pages/settings/index"));
const MyProfile = lazy(() => import("@/pages/profile/index"));
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
const AccountingReconciliation = lazy(() => import("@/pages/accounting/reconciliation"));
const AccountingFixedAssets = lazy(() => import("@/pages/accounting/fixed-assets"));
const AccountingMatching = lazy(() => import("@/pages/accounting/matching"));
const AccountingFiscalPeriods = lazy(() => import("@/pages/accounting/fiscal-periods"));
const AccountingTaxes = lazy(() => import("@/pages/accounting/taxes"));
const AccountingPeriodClose = lazy(() => import("@/pages/accounting/period-close/index"));
const HrDashboard = lazy(() => import("@/pages/hr/index"));
const HrDepartments = lazy(() => import("@/pages/hr/departments"));
const HrPositions = lazy(() => import("@/pages/hr/positions"));
const HrContracts = lazy(() => import("@/pages/hr/contracts"));
const HrDocuments = lazy(() => import("@/pages/hr/documents"));
const HrAssignments = lazy(() => import("@/pages/hr/assignments"));
const HrLeaves = lazy(() => import("@/pages/hr/leaves"));
const HrPayroll = lazy(() => import("@/pages/hr/payroll"));
const HrRecruitment = lazy(() => import("@/pages/hr/recruitment"));
const HrEvaluations = lazy(() => import("@/pages/hr/evaluations"));
const HrTraining = lazy(() => import("@/pages/hr/training"));
const HrMovements = lazy(() => import("@/pages/hr/movements"));
const HrMySpace = lazy(() => import("@/pages/hr/my-space"));
const HrLeavePolicies = lazy(() => import("@/pages/hr/leave-policies"));
const HrTeamCalendar = lazy(() => import("@/pages/hr/team-calendar"));
const HrTimesheets = lazy(() => import("@/pages/hr/timesheets"));
const HrIndicators = lazy(() => import("@/pages/hr/indicators"));
const HrReports = lazy(() => import("@/pages/hr/reports"));
const HrPayrollOffCycle = lazy(() => import("@/pages/hr/payroll-off-cycle"));
const HrTaxSettings = lazy(() => import("@/pages/hr/tax-settings"));
const HrContractTemplates = lazy(() => import("@/pages/hr/contract-templates"));
const HrOnboarding = lazy(() => import("@/pages/hr/onboarding"));
const HrExpenses = lazy(() => import("@/pages/hr/expenses"));
const HrLegalRegister = lazy(() => import("@/pages/hr/legal-register"));
const HrBenefits = lazy(() => import("@/pages/hr/benefits"));
const HrTransferOrders = lazy(() => import("@/pages/hr/transfer-orders"));
const HrPayrollRun = lazy(() => import("@/pages/hr/payroll-run"));
const HrPayrollCalendar = lazy(() => import("@/pages/hr/payroll-calendar"));
const HrPayrollCorrections = lazy(() => import("@/pages/hr/payroll-corrections"));
const HrPayrollDeclarations = lazy(() => import("@/pages/hr/payroll-declarations"));
const AccountingAnalytical = lazy(() => import("@/pages/accounting/analytical"));
const InventoryWarehouses = lazy(() => import("@/pages/inventory/warehouses"));
const CommercialClients = lazy(() => import("@/pages/commercial/clients"));
const CommercialServices = lazy(() => import("@/pages/commercial/services"));
const DocumentsHub = lazy(() => import("@/pages/documents/_wrapper"));
const FinanceIntelligence = lazy(() => import("@/pages/finance/intelligence"));
const TresoreriePage = lazy(() => import("@/pages/finance/tresorerie"));
const RecouvrementPage = lazy(() => import("@/pages/recouvrement/index"));
const HrIntelligence = lazy(() => import("@/pages/hr/intelligence"));
const NotificationsDigest = lazy(() => import("@/pages/notifications/digest"));
const UniversalSearch = lazy(() => import("@/pages/search/index"));
const AssistantPage = lazy(() => import("@/pages/assistant/index"));
const BriefingPage = lazy(() => import("@/pages/briefing/index"));
const ApprovalsQueue = lazy(() => import("@/pages/approvals/index"));
const AnomalyCenter = lazy(() => import("@/pages/anomalies/index"));
const SuperAdminCockpit = lazy(() => import("@/pages/super-admin/index"));
const PublicInvoicePage = lazy(() => import("@/pages/public-invoice"));
const OrgTuner = lazy(() => import("@/pages/org-tuner/index"));
const QuickActions = lazy(() => import("@/pages/quick-actions/index"));
const OperationsCommandCenter = lazy(() => import("@/pages/operations/index"));
const InventoryHub = lazy(() => import("@/pages/inventory/index"));
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
const AlertsPage = lazy(() => import("@/pages/alerts/index"));
const TicketsPage = lazy(() => import("@/pages/tickets/index"));
const FpaDashboard = lazy(() => import("@/pages/fpa/index"));
const FpaCashflow = lazy(() => import("@/pages/fpa/cashflow"));
const FpaBudgets = lazy(() => import("@/pages/fpa/budgets"));
const FpaBudgetDetail = lazy(() => import("@/pages/fpa/budget-detail"));
const FpaVariance = lazy(() => import("@/pages/fpa/variance"));
const FpaForecast = lazy(() => import("@/pages/fpa/forecast"));
const FpaReports = lazy(() => import("@/pages/fpa/reports"));
const PortfolioPage = lazy(() => import("@/pages/projects/portfolio"));
const WorkloadPage = lazy(() => import("@/pages/projects/workload"));
const AdminHub = lazy(() => import("@/pages/admin/index"));
const AdminRoles = lazy(() => import("@/pages/admin/roles"));
const AdminPermissions = lazy(() => import("@/pages/admin/permissions"));
const AdminDepartments = lazy(() => import("@/pages/admin/departments"));
const AdminUsers = lazy(() => import("@/pages/admin/users"));
const AdminInvitations = lazy(() => import("@/pages/admin/invitations"));
const AdminAudit = lazy(() => import("@/pages/admin/audit"));
const ChangePassword = lazy(() => import("@/pages/change-password"));
const AcceptInvitation = lazy(() => import("@/pages/accept-invitation"));
const ResetPassword = lazy(() => import("@/pages/reset-password"));
const OnboardStructure = lazy(() => import("@/pages/onboard-structure"));
const BillingPage = lazy(() => import("@/pages/billing"));
const WorkspaceSettingsPage = lazy(() => import("@/pages/workspace-settings"));
const UpgradeRequiredPage = lazy(() => import("@/pages/upgrade-required"));
const IntelligenceCenter = lazy(() => import("@/pages/intelligence/index"));
const AutomationsPage = lazy(() => import("@/pages/automations/index"));
const AttendancePage = lazy(() => import("@/pages/attendance/index"));
const KioskManagement = lazy(() => import("@/pages/kiosk-management/index"));
const MonEspace = lazy(() => import("@/pages/mon-espace/index"));
const HrOrgchart = lazy(() => import("@/pages/hr/orgchart"));
const CashFlowStatement = lazy(() => import("@/pages/accounting/cash-flow"));
const ManagementPDFPage = lazy(() => import("@/pages/reports/management-pdf"));
const MigrationPage = lazy(() => import("@/pages/migration/index"));
const AchatsOverview = lazy(() => import("@/pages/achats/index"));
const AchatsFournisseurs = lazy(() => import("@/pages/achats/fournisseurs"));
const AchatsFactures = lazy(() => import("@/pages/achats/factures"));
const AchatsBonsCommande = lazy(() => import("@/pages/achats/bons-de-commande"));
const AchatsPaiements = lazy(() => import("@/pages/achats/paiements"));
const AchatsDepenses = lazy(() => import("@/pages/achats/depenses"));
const AchatsApprobations = lazy(() => import("@/pages/achats/approbations"));
const AchatsRapports = lazy(() => import("@/pages/achats/rapports"));

// ── Cache global réglé pour confort + fraîcheur raisonnable ────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 2 * 60 * 1000,    // 2min : données considérées fraîches
      gcTime: 10 * 60 * 1000,      // 10min : conservation cache mémoire
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
      <Route path="/facture/:token">
        <Suspense fallback={<PageFallback />}><PublicInvoicePage /></Suspense>
      </Route>
      <Route path="/accept-invitation">
        <Suspense fallback={<PageFallback />}><AcceptInvitation /></Suspense>
      </Route>
      <Route path="/reset-password">
        <Suspense fallback={<PageFallback />}><ResetPassword /></Suspense>
      </Route>
      <Route path="/onboard-structure">
        <Suspense fallback={<PageFallback />}><OnboardStructure /></Suspense>
      </Route>
      <Route path="/documents/:type/:id/print">
        <ProtectedRoute>
          <Suspense fallback={<PageFallback />}><PrintDocument /></Suspense>
        </ProtectedRoute>
      </Route>
      <Route path="/reports/management/pdf">
        <ProtectedRoute>
          <Suspense fallback={<PageFallback />}><ManagementPDFPage /></Suspense>
        </ProtectedRoute>
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
                <Route path="/portfolio" component={PortfolioPage} />
                <Route path="/workload" component={WorkloadPage} />

                <Route path="/tasks/focus" component={TasksHub} />
                <Route path="/tasks/:id" component={TaskDetail} />
                <Route path="/tasks" component={TasksHub} />

                <Route path="/crm" component={CrmHub} />
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
                <Route path="/collaborators/:id/badge" component={CollaboratorBadgePrint} />
                <Route path="/collaborators/:id" component={CollaboratorDetail} />

                <Route path="/rentals" component={RentalsList} />
                <Route path="/rentals/:id" component={RentalDetail} />
                <Route path="/inspections" component={InspectionsList} />
                <Route path="/logistics" component={LogisticsList} />

                <Route path="/pricing" component={PricingCalculator} />
                <Route path="/orders" component={OrdersList} />
                <Route path="/proformas" component={ProformasList} />
                <Route path="/invoices" component={InvoicesList} />
                <Route path="/payments" component={PaymentsList} />
                <Route path="/credit-notes" component={CreditNotesList} />

                <Route path="/messaging" component={Messaging} />
                <Route path="/calls" component={CallsList} />
                <Route path="/users" component={UsersList} />
                <Route path="/notifications" component={NotificationsList} />
                <Route path="/settings" component={Settings} />
                <Route path="/profile" component={MyProfile} />

                <Route path="/fpa" component={FpaDashboard} />
                <Route path="/fpa/budgets" component={FpaBudgets} />
                <Route path="/fpa/budgets/:id" component={FpaBudgetDetail} />
                <Route path="/fpa/variance" component={FpaVariance} />
                <Route path="/fpa/forecast" component={FpaForecast} />
                <Route path="/fpa/cashflow" component={FpaCashflow} />
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
                <Route path="/accounting/reconciliation" component={AccountingReconciliation} />
                <Route path="/accounting/fixed-assets" component={AccountingFixedAssets} />
                <Route path="/accounting/matching" component={AccountingMatching} />
                <Route path="/accounting/fiscal-periods" component={AccountingFiscalPeriods} />
                <Route path="/accounting/taxes" component={AccountingTaxes} />
                <Route path="/accounting/period-close" component={AccountingPeriodClose} />

                <Route path="/hr" component={HrDashboard} />
                <Route path="/hr/departments" component={HrDepartments} />
                <Route path="/hr/positions" component={HrPositions} />
                <Route path="/hr/contracts" component={HrContracts} />
                <Route path="/hr/documents" component={HrDocuments} />
                <Route path="/hr/assignments" component={HrAssignments} />
                <Route path="/hr/leaves" component={HrLeaves} />
                <Route path="/hr/payroll" component={HrPayroll} />
                <Route path="/hr/recruitment" component={HrRecruitment} />
                <Route path="/hr/evaluations" component={HrEvaluations} />
                <Route path="/hr/training" component={HrTraining} />
                <Route path="/hr/movements" component={HrMovements} />
                <Route path="/hr/my-space" component={HrMySpace} />
                <Route path="/hr/leave-policies" component={HrLeavePolicies} />
                <Route path="/hr/team-calendar" component={HrTeamCalendar} />
                <Route path="/hr/timesheets" component={HrTimesheets} />
                <Route path="/hr/indicators" component={HrIndicators} />
                <Route path="/hr/reports" component={HrReports} />
                <Route path="/accounting/analytical" component={AccountingAnalytical} />
                <Route path="/inventory/warehouses" component={InventoryWarehouses} />

                <Route path="/commercial/clients" component={CommercialClients} />
                <Route path="/commercial/services" component={CommercialServices} />
                <Route path="/sales/scoring" component={CrmHub} />
                <Route path="/documents/intelligence" component={DocumentsHub} />
                <Route path="/finance/intelligence" component={FinanceIntelligence} />
                <Route path="/finance/tresorerie" component={TresoreriePage} />
                <Route path="/recouvrement" component={RecouvrementPage} />
                <Route path="/migration" component={MigrationPage} />
                <Route path="/hr/intelligence" component={HrIntelligence} />
                <Route path="/notifications/digest" component={NotificationsDigest} />
                <Route path="/search" component={UniversalSearch} />
                <Route path="/assistant" component={AssistantPage} />
                <Route path="/briefing" component={BriefingPage} />
                <Route path="/pipeline/intelligence" component={CrmHub} />
                <Route path="/approvals" component={ApprovalsQueue} />
                <Route path="/anomalies" component={AnomalyCenter} />
                <Route path="/super-admin" component={SuperAdminCockpit} />
                <Route path="/org-tuner" component={OrgTuner} />
                <Route path="/quick" component={QuickActions} />
                <Route path="/operations" component={OperationsCommandCenter} />
                <Route path="/inventory" component={InventoryHub} />
                <Route path="/inventory/:tab" component={InventoryHub} />

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

                <Route path="/documents" component={DocumentsHub} />
                <Route path="/alerts" component={AlertsPage} />
                <Route path="/tickets" component={TicketsPage} />
                <Route path="/intelligence" component={IntelligenceCenter} />
                <Route path="/automations" component={AutomationsPage} />
                <Route path="/attendance" component={AttendancePage} />
                <Route path="/kiosk-management" component={KioskManagement} />
                <Route path="/mon-espace" component={MonEspace} />
                <Route path="/hr/orgchart" component={HrOrgchart} />
                <Route path="/hr/payroll/run/:id" component={HrPayrollRun} />
                <Route path="/hr/payroll/calendar" component={HrPayrollCalendar} />
                <Route path="/hr/payroll/declarations" component={HrPayrollDeclarations} />
                <Route path="/hr/payroll/corrections" component={HrPayrollCorrections} />
                <Route path="/hr/payroll/off-cycle" component={HrPayrollOffCycle} />
                <Route path="/hr/tax-settings" component={HrTaxSettings} />
                <Route path="/hr/contract-templates" component={HrContractTemplates} />
                <Route path="/hr/onboarding" component={HrOnboarding} />
                <Route path="/hr/expenses" component={HrExpenses} />
                <Route path="/hr/legal-register" component={HrLegalRegister} />
                <Route path="/hr/benefits" component={HrBenefits} />
                <Route path="/hr/transfer-orders" component={HrTransferOrders} />
                <Route path="/accounting/cash-flow" component={CashFlowStatement} />

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

                <Route path="/achats" component={AchatsOverview} />
                <Route path="/achats/fournisseurs" component={AchatsFournisseurs} />
                <Route path="/achats/factures" component={AchatsFactures} />
                <Route path="/achats/bons-de-commande" component={AchatsBonsCommande} />
                <Route path="/achats/paiements" component={AchatsPaiements} />
                <Route path="/achats/depenses" component={AchatsDepenses} />
                <Route path="/achats/approbations" component={AchatsApprobations} />
                <Route path="/achats/rapports" component={AchatsRapports} />

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
