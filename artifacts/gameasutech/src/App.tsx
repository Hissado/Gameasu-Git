import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/context/LanguageContext";
import { Layout } from "@/components/Layout";
import { ChatBot } from "@/components/ChatBot";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import About from "@/pages/About";
import Services from "@/pages/Services";
import Industries from "@/pages/Industries";
import Cybersecurity from "@/pages/Cybersecurity";
import AIAutomation from "@/pages/AIAutomation";
import CloudInfrastructure from "@/pages/CloudInfrastructure";
import CaseStudies from "@/pages/CaseStudies";
import Blog from "@/pages/Blog";
import Partners from "@/pages/Partners";
import Careers from "@/pages/Careers";
import Contact from "@/pages/Contact";
import Support from "@/pages/Support";
import Solutions from "@/pages/Solutions";
import FAQ from "@/pages/FAQ";
import Privacy from "@/pages/Privacy";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/about" component={About} />
        <Route path="/services" component={Services} />
        <Route path="/industries" component={Industries} />
        <Route path="/cybersecurity" component={Cybersecurity} />
        <Route path="/ai-automation" component={AIAutomation} />
        <Route path="/cloud-infrastructure" component={CloudInfrastructure} />
        <Route path="/solutions" component={Solutions} />
        <Route path="/case-studies" component={CaseStudies} />
        <Route path="/blog" component={Blog} />
        <Route path="/partners" component={Partners} />
        <Route path="/careers" component={Careers} />
        <Route path="/contact" component={Contact} />
        <Route path="/support" component={Support} />
        <Route path="/faq" component={FAQ} />
        <Route path="/privacy" component={Privacy} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LanguageProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
            <ChatBot />
          </WouterRouter>
          <Toaster />
        </LanguageProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
