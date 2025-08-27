import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Header from "@/components/header";
import Footer from "@/components/footer";
import ChatbotWidget from "@/components/chatbot-widget";
import AccueilPage from "@/pages/accueil";
import FilieresPage from "@/pages/filieres";
import AProposPage from "@/pages/a-propos";
import ActualitesPage from "@/pages/actualites";
import ContactPage from "@/pages/contact";
import CampusPage from "@/pages/campus";
import AdminLogin from "@/pages/admin-login";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminContent from "@/pages/admin-content";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <div className="min-h-screen">
      <Header />
      <Switch>
        <Route path="/" component={AccueilPage} />
        <Route path="/accueil" component={AccueilPage} />
        <Route path="/filieres" component={FilieresPage} />
        <Route path="/a-propos" component={AProposPage} />
        <Route path="/actualites" component={ActualitesPage} />
        <Route path="/contact" component={ContactPage} />
        <Route path="/campus" component={CampusPage} />
        <Route path="/admin/login" component={AdminLogin} />
        <Route path="/admin/dashboard" component={AdminDashboard} />
        <Route path="/admin/content" component={AdminContent} />
        <Route component={NotFound} />
      </Switch>
      <Footer />
      <ChatbotWidget />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
