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
