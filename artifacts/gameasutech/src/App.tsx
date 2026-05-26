import React, { Suspense, lazy, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/context/LanguageContext";
import { Layout } from "@/components/Layout";
import { ChatBot } from "@/components/ChatBot";

const Home = lazy(() => import("@/pages/Home"));
const About = lazy(() => import("@/pages/About"));
const Services = lazy(() => import("@/pages/Services"));
const Industries = lazy(() => import("@/pages/Industries"));
const Cybersecurity = lazy(() => import("@/pages/Cybersecurity"));
const AIAutomation = lazy(() => import("@/pages/AIAutomation"));
const CloudInfrastructure = lazy(() => import("@/pages/CloudInfrastructure"));
const Solutions = lazy(() => import("@/pages/Solutions"));
const CaseStudies = lazy(() => import("@/pages/CaseStudies"));
const Blog = lazy(() => import("@/pages/Blog"));
const Partners = lazy(() => import("@/pages/Partners"));
const Careers = lazy(() => import("@/pages/Careers"));
const Contact = lazy(() => import("@/pages/Contact"));
const Support = lazy(() => import("@/pages/Support"));
const FAQ = lazy(() => import("@/pages/FAQ"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const NotFound = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    </div>
  );
}

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location]);
  return null;
}

function Router() {
  return (
    <Layout>
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
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
      </Suspense>
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
