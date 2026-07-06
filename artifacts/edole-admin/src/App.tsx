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
import RegisterPage from "@/pages/register";
import PaiementRequisPage from "@/pages/paiement-requis";
import DemanderAcces from "@/pages/demander-acces";
import ChoisirOrganisationPage from "@/pages/choisir-organisation";
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
const HrSimulateur = lazy(() => import("@/pages/hr/simulateur"));
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
const AssistantIaPage = lazy(() => import("@/pages/assistant-ia/index"));
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
const AcceptExpertInvitation = lazy(() => import("@/pages/accept-expert-invitation"));
const ResetPassword = lazy(() => import("@/pages/reset-password"));
const OnboardStructure = lazy(() => import("@/pages/onboard-structure"));
const BillingPage = lazy(() => import("@/pages/billing"));
const BillingReturn = lazy(() => import("@/pages/billing-return"));
const WorkspaceSettingsPage = lazy(() => import("@/pages/workspace-settings"));
const UpgradeRequiredPage = lazy(() => import("@/pages/upgrade-required"));
const IntelligenceCenter = lazy(() => import("@/pages/intelligence/index"));
const AutomationsPage = lazy(() => import("@/pages/automations/index"));
const AttendancePage = lazy(() => import("@/pages/attendance/index"));
const KioskManagement = lazy(() => import("@/pages/kiosk-management/index"));
const MonEspace = lazy(() => import("@/pages/mon-espace/index"));
const HrOrgchart = lazy(() => import("@/pages/hr/orgchart"));
const HrAuditLog = lazy(() => import("@/pages/hr/audit-log"));
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
const ExpertDashboard = lazy(() => import("@/pages/expert/index"));
const ExpertClients = lazy(() => import("@/pages/expert/clients"));
const ExpertClientConfig = lazy(() => import("@/pages/expert/client-config"));
const ExpertUsersPermissions = lazy(() => import("@/pages/expert/users-permissions"));
const ExpertDocumentRequests = lazy(() => import("@/pages/expert/document-requests"));
const ExpertReports = lazy(() => import("@/pages/expert/reports"));
const ExpertFirmSettings = lazy(() => import("@/pages/expert/firm-settings"));
const BtpPointage = lazy(() => import("@/pages/hr/btp-pointage"));
const BtpPaie = lazy(() => import("@/pages/hr/btp-paie"));
const BtpSettings = lazy(() => import("@/pages/hr/btp-settings"));

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
      <Route path="/register" component={RegisterPage} />
      <Route path="/paiement-requis" component={PaiementRequisPage} />
      <Route path="/demander-acces" component={DemanderAcces} />
      <Route path="/choisir-organisation" component={ChoisirOrganisationPage} />
      <Route path="/facture/:token">
        <Suspense fallback={<PageFallback />}><PublicInvoicePage /></Suspense>
      </Route>
      <Route path="/accept-invitation">
        <Suspense fallback={<PageFallback />}><AcceptInvitation /></Suspense>
      </Route>
      <Route path="/accept-expert-invitation">
        <Suspense fallback={<PageFallback />}><AcceptExpertInvitation /></Suspense>
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
      <Route path="/rapports/gestion/pdf">
        <ProtectedRoute>
          <Suspense fallback={<PageFallback />}><ManagementPDFPage /></Suspense>
        </ProtectedRoute>
      </Route>
      <Route path="/billing/paiement-retour">
        <ProtectedRoute>
          <Suspense fallback={<PageFallback />}><BillingReturn /></Suspense>
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

                <Route path="/projets" component={ProjectsList} />
                <Route path="/projets/:id" component={ProjectDetail} />
                <Route path="/portefeuille" component={PortfolioPage} />
                <Route path="/charge" component={WorkloadPage} />

                <Route path="/tasks/focus" component={TasksHub} />
                <Route path="/tasks/:id" component={TaskDetail} />
                <Route path="/tasks" component={TasksHub} />

                <Route path="/crm" component={CrmHub} />
                <Route path="/crm/clients" component={ClientsList} />
                <Route path="/crm/clients/:id" component={ClientDetail} />
                <Route path="/crm/activities" component={ActivitiesList} />

                <Route path="/equipements" component={EquipmentList} />
                <Route path="/equipements/categories" component={EquipmentCategories} />
                <Route path="/equipements/qr" component={EquipmentQRCodes} />
                <Route path="/rapports" component={ReportsPage} />
                <Route path="/carte" component={MapPage} />
                <Route path="/inspections/comparer/:rentalId" component={InspectionCompare} />

                <Route path="/collaborateurs" component={CollaboratorsList} />
                <Route path="/collaborateurs/:id/badge" component={CollaboratorBadgePrint} />
                <Route path="/collaborateurs/:id" component={CollaboratorDetail} />

                <Route path="/locations" component={RentalsList} />
                <Route path="/locations/:id" component={RentalDetail} />
                <Route path="/inspections" component={InspectionsList} />
                <Route path="/logistique" component={LogisticsList} />

                <Route path="/tarification" component={PricingCalculator} />
                <Route path="/commandes" component={OrdersList} />
                <Route path="/devis" component={ProformasList} />
                <Route path="/factures" component={InvoicesList} />
                <Route path="/paiements" component={PaymentsList} />
                <Route path="/avoirs" component={CreditNotesList} />

                <Route path="/messaging" component={Messaging} />
                <Route path="/appels" component={CallsList} />
                <Route path="/utilisateurs" component={UsersList} />
                <Route path="/notifications" component={NotificationsList} />
                <Route path="/parametres" component={Settings} />
                <Route path="/profil" component={MyProfile} />

                <Route path="/fpa" component={FpaDashboard} />
                <Route path="/fpa/budgets" component={FpaBudgets} />
                <Route path="/fpa/budgets/:id" component={FpaBudgetDetail} />
                <Route path="/fpa/variance" component={FpaVariance} />
                <Route path="/fpa/forecast" component={FpaForecast} />
                <Route path="/fpa/cashflow" component={FpaCashflow} />
                <Route path="/fpa/reports" component={FpaReports} />

                <Route path="/comptabilite" component={AccountingDashboard} />
                <Route path="/comptabilite/plan-comptable" component={AccountingChart} />
                <Route path="/comptabilite/ecritures" component={AccountingEntries} />
                <Route path="/comptabilite/grand-livre" component={AccountingLedger} />
                <Route path="/comptabilite/balance" component={AccountingBalance} />
                <Route path="/comptabilite/compte-de-resultat" component={AccountingIncome} />
                <Route path="/comptabilite/bilan" component={AccountingBalanceSheet} />
                <Route path="/comptabilite/clients" component={AccountingCustomers} />
                <Route path="/comptabilite/fournisseurs" component={AccountingSuppliers} />
                <Route path="/comptabilite/banques" component={AccountingBanks} />
                <Route path="/comptabilite/rapprochement" component={AccountingReconciliation} />
                <Route path="/comptabilite/immobilisations" component={AccountingFixedAssets} />
                <Route path="/comptabilite/lettrage" component={AccountingMatching} />
                <Route path="/comptabilite/periodes-fiscales" component={AccountingFiscalPeriods} />
                <Route path="/comptabilite/taxes" component={AccountingTaxes} />
                <Route path="/comptabilite/cloture" component={AccountingPeriodClose} />

                <Route path="/rh" component={HrDashboard} />
                <Route path="/rh/departements" component={HrDepartments} />
                <Route path="/rh/postes" component={HrPositions} />
                <Route path="/rh/contrats" component={HrContracts} />
                <Route path="/rh/documents" component={HrDocuments} />
                <Route path="/rh/affectations" component={HrAssignments} />
                <Route path="/rh/conges" component={HrLeaves} />
                <Route path="/rh/paie" component={HrPayroll} />
                <Route path="/rh/recrutement" component={HrRecruitment} />
                <Route path="/rh/evaluations" component={HrEvaluations} />
                <Route path="/rh/formations" component={HrTraining} />
                <Route path="/rh/mouvements" component={HrMovements} />
                <Route path="/rh/mon-espace" component={HrMySpace} />
                <Route path="/rh/politiques-conges" component={HrLeavePolicies} />
                <Route path="/rh/calendrier-equipe" component={HrTeamCalendar} />
                <Route path="/rh/feuilles-temps" component={HrTimesheets} />
                <Route path="/rh/indicateurs" component={HrIndicators} />
                <Route path="/rh/rapports" component={HrReports} />
                <Route path="/rh/simulateur" component={HrSimulateur} />
                <Route path="/comptabilite/analytique" component={AccountingAnalytical} />
                <Route path="/stock/entrepots" component={InventoryWarehouses} />

                <Route path="/commercial/clients" component={CommercialClients} />
                <Route path="/commercial/services" component={CommercialServices} />
                <Route path="/sales/scoring" component={CrmHub} />
                <Route path="/documents/intelligence" component={DocumentsHub} />
                <Route path="/finance/intelligence" component={FinanceIntelligence} />
                <Route path="/finance/tresorerie" component={TresoreriePage} />
                <Route path="/recouvrement" component={RecouvrementPage} />
                <Route path="/migration" component={MigrationPage} />
                <Route path="/rh/intelligence" component={HrIntelligence} />
                <Route path="/rh/btp-pointage" component={BtpPointage} />
                <Route path="/rh/btp-paie" component={BtpPaie} />
                <Route path="/rh/btp-parametres" component={BtpSettings} />
                <Route path="/notifications/synthese" component={NotificationsDigest} />
                <Route path="/recherche" component={UniversalSearch} />
                <Route path="/assistant" component={AssistantPage} />
                <Route path="/assistant-ia" component={AssistantIaPage} />
                <Route path="/briefing" component={BriefingPage} />
                <Route path="/pipeline/intelligence" component={CrmHub} />
                <Route path="/approbations" component={ApprovalsQueue} />
                <Route path="/anomalies" component={AnomalyCenter} />
                <Route path="/super-admin" component={SuperAdminCockpit} />
                <Route path="/org-tuner" component={OrgTuner} />
                <Route path="/quick" component={QuickActions} />
                <Route path="/operations" component={OperationsCommandCenter} />
                <Route path="/stock" component={InventoryHub} />
                <Route path="/stock/:tab" component={InventoryHub} />

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
                <Route path="/alertes" component={AlertsPage} />
                <Route path="/tickets" component={TicketsPage} />
                <Route path="/intelligence" component={IntelligenceCenter} />
                <Route path="/automations" component={AutomationsPage} />
                <Route path="/presences" component={AttendancePage} />
                <Route path="/kiosques" component={KioskManagement} />
                <Route path="/mon-espace" component={MonEspace} />
                <Route path="/rh/organigramme" component={HrOrgchart} />
                <Route path="/rh/journal-audit" component={HrAuditLog} />
                <Route path="/rh/paie/run/:id" component={HrPayrollRun} />
                <Route path="/rh/paie/calendrier" component={HrPayrollCalendar} />
                <Route path="/rh/paie/declarations" component={HrPayrollDeclarations} />
                <Route path="/rh/paie/corrections" component={HrPayrollCorrections} />
                <Route path="/rh/paie/hors-cycle" component={HrPayrollOffCycle} />
                <Route path="/rh/fiscalite" component={HrTaxSettings} />
                <Route path="/rh/modeles-contrats" component={HrContractTemplates} />
                <Route path="/rh/integration" component={HrOnboarding} />
                <Route path="/rh/notes-frais" component={HrExpenses} />
                <Route path="/rh/registre-legal" component={HrLegalRegister} />
                <Route path="/rh/avantages" component={HrBenefits} />
                <Route path="/rh/virements" component={HrTransferOrders} />
                <Route path="/comptabilite/flux-tresorerie" component={CashFlowStatement} />

                <Route path="/admin" component={AdminHub} />
                <Route path="/admin/roles" component={AdminRoles} />
                <Route path="/admin/permissions" component={AdminPermissions} />
                <Route path="/admin/departments" component={AdminDepartments} />
                <Route path="/admin/users" component={AdminUsers} />
                <Route path="/admin/invitations" component={AdminInvitations} />
                <Route path="/admin/audit" component={AdminAudit} />
                <Route path="/changer-mdp" component={ChangePassword} />

                <Route path="/abonnement" component={BillingPage} />
                <Route path="/workspace-settings" component={WorkspaceSettingsPage} />
                <Route path="/mise-a-niveau" component={UpgradeRequiredPage} />

                <Route path="/achats" component={AchatsOverview} />
                <Route path="/achats/fournisseurs" component={AchatsFournisseurs} />
                <Route path="/achats/factures" component={AchatsFactures} />
                <Route path="/achats/bons-de-commande" component={AchatsBonsCommande} />
                <Route path="/achats/paiements" component={AchatsPaiements} />
                <Route path="/achats/depenses" component={AchatsDepenses} />
                <Route path="/achats/approbations" component={AchatsApprobations} />
                <Route path="/achats/rapports" component={AchatsRapports} />

                <Route path="/expert" component={ExpertDashboard} />
                <Route path="/expert/clients" component={ExpertClients} />
                <Route path="/expert/client-config" component={ExpertClientConfig} />
                <Route path="/expert/users-permissions" component={ExpertUsersPermissions} />
                <Route path="/expert/document-requests" component={ExpertDocumentRequests} />
                <Route path="/expert/reports" component={ExpertReports} />
                <Route path="/expert/firm-settings" component={ExpertFirmSettings} />

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
