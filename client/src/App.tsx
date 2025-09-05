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
import ActualiteDetail from "@/pages/actualite-detail";
import ContactPage from "@/pages/contact";
import CampusPage from "@/pages/campus";
import CabinetPage from "@/pages/cabinet";
import TarifsPage from "@/pages/tarifs";
import AdminLogin from "@/pages/admin-login";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminContent from "@/pages/admin-content";
import AdminSliders from "@/pages/admin-sliders";
import AdminFounder from "@/pages/admin-founder";
import AdminInstitutes from "@/pages/admin-institutes";
import AdminPrograms from "@/pages/admin-programs";
import AdminNews from "@/pages/admin-news";
import AdminProjects from "@/pages/admin-projects";
import NotFound from "@/pages/not-found";

// Layout for public website pages
function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Header />
      {children}
      <Footer />
      <ChatbotWidget />
    </div>
  );
}

// Layout for admin pages (completely separate)
function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}

function Router() {
  return (
    <Switch>
      {/* Admin routes - completely separate layout */}
      <Route path="/admin/login">
        <AdminLayout>
          <AdminLogin />
        </AdminLayout>
      </Route>
      <Route path="/admin/dashboard">
        <AdminLayout>
          <AdminDashboard />
        </AdminLayout>
      </Route>
      <Route path="/admin/content">
        <AdminLayout>
          <AdminContent />
        </AdminLayout>
      </Route>
      <Route path="/admin/sliders">
        <AdminLayout>
          <AdminSliders />
        </AdminLayout>
      </Route>
      <Route path="/admin/founder">
        <AdminLayout>
          <AdminFounder />
        </AdminLayout>
      </Route>
      <Route path="/admin/institutes">
        <AdminLayout>
          <AdminInstitutes />
        </AdminLayout>
      </Route>
      <Route path="/admin/programs">
        <AdminLayout>
          <AdminPrograms />
        </AdminLayout>
      </Route>
      <Route path="/admin/news">
        <AdminLayout>
          <AdminNews />
        </AdminLayout>
      </Route>
      <Route path="/admin/projects">
        <AdminLayout>
          <AdminProjects />
        </AdminLayout>
      </Route>
      
      {/* Public website routes - with header, footer, chatbot */}
      <Route path="/">
        <PublicLayout>
          <AccueilPage />
        </PublicLayout>
      </Route>
      <Route path="/accueil">
        <PublicLayout>
          <AccueilPage />
        </PublicLayout>
      </Route>
      <Route path="/filieres">
        <PublicLayout>
          <FilieresPage />
        </PublicLayout>
      </Route>
      <Route path="/a-propos">
        <PublicLayout>
          <AProposPage />
        </PublicLayout>
      </Route>
      <Route path="/actualites">
        <PublicLayout>
          <ActualitesPage />
        </PublicLayout>
      </Route>
      <Route path="/actualites/:id">
        <PublicLayout>
          <ActualiteDetail />
        </PublicLayout>
      </Route>
      <Route path="/contact">
        <PublicLayout>
          <ContactPage />
        </PublicLayout>
      </Route>
      <Route path="/campus">
        <PublicLayout>
          <CampusPage />
        </PublicLayout>
      </Route>
      <Route path="/cabinet">
        <PublicLayout>
          <CabinetPage />
        </PublicLayout>
      </Route>
      <Route path="/tarifs">
        <PublicLayout>
          <TarifsPage />
        </PublicLayout>
      </Route>
      
      {/* 404 page */}
      <Route>
        <PublicLayout>
          <NotFound />
        </PublicLayout>
      </Route>
    </Switch>
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
