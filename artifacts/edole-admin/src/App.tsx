import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Layout } from "@/components/Layout";

import LoginPage from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import ProjectsList from "@/pages/projects/index";
import ProjectDetail from "@/pages/projects/detail";
import TasksList from "@/pages/tasks/index";
import TaskDetail from "@/pages/tasks/detail";
import CrmHome from "@/pages/crm/index";
import ClientsList from "@/pages/crm/clients/index";
import ClientDetail from "@/pages/crm/clients/detail";
import ActivitiesList from "@/pages/crm/activities/index";
import EquipmentList from "@/pages/equipment/index";
import EquipmentCategories from "@/pages/equipment/categories/index";
import EquipmentQRCodes from "@/pages/equipment/qr";
import ReportsPage from "@/pages/reports/index";
import MapPage from "@/pages/map/index";
import InspectionCompare from "@/pages/inspections/compare";
import CollaboratorsList from "@/pages/collaborators/index";
import CollaboratorDetail from "@/pages/collaborators/detail";
import RentalsList from "@/pages/rentals/index";
import RentalDetail from "@/pages/rentals/detail";
import InspectionsList from "@/pages/inspections/index";
import LogisticsList from "@/pages/logistics/index";
import ProformasList from "@/pages/proformas/index";
import OrdersList from "@/pages/orders/index";
import InvoicesList from "@/pages/invoices/index";
import PaymentsList from "@/pages/payments/index";
import Messaging from "@/pages/messaging/index";
import CallsList from "@/pages/calls/index";
import UsersList from "@/pages/users/index";
import NotificationsList from "@/pages/notifications/index";
import Settings from "@/pages/settings/index";
import AccountingDashboard from "@/pages/accounting/index";
import AccountingChart from "@/pages/accounting/chart-of-accounts";
import AccountingEntries from "@/pages/accounting/entries";
import AccountingLedger from "@/pages/accounting/ledger";
import AccountingBalance from "@/pages/accounting/balance";
import AccountingIncome from "@/pages/accounting/income-statement";
import AccountingBalanceSheet from "@/pages/accounting/balance-sheet";
import AccountingCustomers from "@/pages/accounting/customers";
import AccountingSuppliers from "@/pages/accounting/suppliers";
import AccountingBanks from "@/pages/accounting/banks";
import AccountingFixedAssets from "@/pages/accounting/fixed-assets";
import HrDashboard from "@/pages/hr/index";
import HrDepartments from "@/pages/hr/departments";
import HrPositions from "@/pages/hr/positions";
import HrContracts from "@/pages/hr/contracts";
import HrDocuments from "@/pages/hr/documents";
import HrAssignments from "@/pages/hr/assignments";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route>
        <ProtectedRoute>
          <Layout>
            <Switch>
              <Route path="/" component={Dashboard} />
              
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

              <Route component={NotFound} />
            </Switch>
          </Layout>
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
