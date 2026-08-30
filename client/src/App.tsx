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
import AdminTariffs from "@/pages/admin-tariffs";
import AdminGallery from "@/pages/admin-gallery";
import AdminLeads from "@/pages/admin-leads";
import ProjectDetail from "@/pages/project-detail";
import Galerie from "@/pages/galerie";
import AlbumDetail from "@/pages/album-detail";
import HistoriquePage from "@/pages/historique";
import ObjectifsPage from "@/pages/objectifs";
import InstitutsPage from "@/pages/instituts";
import UniversiteEntrepreneuriatPage from "@/pages/universite-entrepreneuriat";
import NousTrouverPage from "@/pages/nous-trouver";
import MissionCabinetPage from "@/pages/mission-cabinet";
import CentreIncubationPage from "@/pages/centre-incubation";
import FormationsSeminairesPage from "@/pages/formations-seminaires";
import VideothequePage from "@/pages/videotheque";
import PreinscriptionPage from "@/pages/preinscription";
import Resultats2026Page from "@/pages/resultats-2026";
import NotFound from "@/pages/not-found";
import { MessageCircle } from "lucide-react";

// Layout for public website pages
function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Header />
      {children}
      <Footer />
      <ChatbotWidget />
      {/* WhatsApp — canal de contact privilégié pour la préinscription */}
      <a
        href={
          "https://wa.me/2250747726729?text=" +
          encodeURIComponent(
            "Bonjour, je souhaite des informations pour la préinscription au Groupe 2IAE.",
          )
        }
        target="_blank"
        rel="noreferrer"
        aria-label="Nous écrire sur WhatsApp"
        data-testid="button-whatsapp"
        className="fixed bottom-5 left-5 z-50 flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-xl px-4 py-3 font-semibold transition-colors"
      >
        <MessageCircle className="h-6 w-6" />
        <span className="hidden sm:inline">WhatsApp</span>
      </a>
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
      <Route path="/admin/tariffs">
        <AdminLayout>
          <AdminTariffs />
        </AdminLayout>
      </Route>
      <Route path="/admin/gallery">
        <AdminLayout>
          <AdminGallery />
        </AdminLayout>
      </Route>
      <Route path="/admin/leads">
        <AdminLayout>
          <AdminLeads />
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
      <Route path="/cabinet/:id">
        <PublicLayout>
          <ProjectDetail />
        </PublicLayout>
      </Route>
      <Route path="/tarifs">
        <PublicLayout>
          <TarifsPage />
        </PublicLayout>
      </Route>
      <Route path="/galerie">
        <PublicLayout>
          <Galerie />
        </PublicLayout>
      </Route>
      <Route path="/galerie/:id">
        <PublicLayout>
          <AlbumDetail />
        </PublicLayout>
      </Route>

      {/* Pages restaurées de l'ancien site */}
      <Route path="/historique">
        <PublicLayout>
          <HistoriquePage />
        </PublicLayout>
      </Route>
      <Route path="/objectifs">
        <PublicLayout>
          <ObjectifsPage />
        </PublicLayout>
      </Route>
      <Route path="/instituts">
        <PublicLayout>
          <InstitutsPage />
        </PublicLayout>
      </Route>
      <Route path="/universite-entrepreneuriat">
        <PublicLayout>
          <UniversiteEntrepreneuriatPage />
        </PublicLayout>
      </Route>
      <Route path="/nous-trouver">
        <PublicLayout>
          <NousTrouverPage />
        </PublicLayout>
      </Route>
      <Route path="/mission-cabinet">
        <PublicLayout>
          <MissionCabinetPage />
        </PublicLayout>
      </Route>
      <Route path="/centre-incubation">
        <PublicLayout>
          <CentreIncubationPage />
        </PublicLayout>
      </Route>
      <Route path="/formations-seminaires">
        <PublicLayout>
          <FormationsSeminairesPage />
        </PublicLayout>
      </Route>
      <Route path="/videotheque">
        <PublicLayout>
          <VideothequePage />
        </PublicLayout>
      </Route>
      <Route path="/preinscription">
        <PublicLayout>
          <PreinscriptionPage />
        </PublicLayout>
      </Route>
      <Route path="/resultats-bts-2026">
        <PublicLayout>
          <Resultats2026Page />
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
