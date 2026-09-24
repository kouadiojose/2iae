// Application du campus : rassemble les routes de tous les modules,
// applique les droits d'accès et la coquille de navigation.
import { Suspense, useEffect } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { FournisseurAuth, useMoi, accueilDuRole } from "@/lib/auth";
import { FournisseurFlux } from "@/lib/flux";
import { Coquille } from "@/components/layout/coquille";
import { Toasts } from "@/components/ui/toast";
import { LienBouton } from "@/components/ui/bouton";
import type { DefRoute } from "@/routes-types";

// Toutes les routes déclarées par les modules (modules/*/routes.tsx).
const modulesRoutes = import.meta.glob<{ routes: DefRoute[] }>("./modules/*/routes.tsx", { eager: true });
const ROUTES: DefRoute[] = Object.values(modulesRoutes).flatMap((m) => m.routes);

function EcranChargement() {
  return (
    <div className="grid min-h-[60dvh] place-items-center" aria-busy="true">
      <div className="flex items-center gap-3 font-mono text-sm text-texte-gris">
        <span className="point-direct bg-orange" />
        Chargement du campus…
      </div>
    </div>
  );
}

function PageInterdite() {
  const { moi } = useMoi();
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-24 text-center">
      <span className="etiquette">Accès réservé</span>
      <h1 className="text-3xl font-black">Cette page n'est pas pour ton compte.</h1>
      <p className="text-texte-pale">Elle est réservée à un autre profil du campus. Tu peux revenir à ton accueil.</p>
      <LienBouton href={moi ? accueilDuRole(moi.role) : "/"}>Revenir à mon accueil</LienBouton>
    </div>
  );
}

function PageIntrouvable() {
  const { moi } = useMoi();
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-24 text-center">
      <span className="etiquette">Erreur 404</span>
      <h1 className="text-3xl font-black">Page introuvable.</h1>
      <p className="text-texte-pale">Le lien est peut-être incomplet ou la page a été déplacée.</p>
      <LienBouton href={moi ? accueilDuRole(moi.role) : "/"}>Revenir à l'accueil</LienBouton>
    </div>
  );
}

function Garde({ def, params }: { def: DefRoute; params: Record<string, string> }) {
  const { moi, chargement } = useMoi();
  const [chemin] = useLocation();
  const Page = def.page;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [chemin]);

  if (chargement) return <EcranChargement />;

  if (def.acces === "public") {
    if (moi && def.redirigerSiConnecte) return <Redirect to={accueilDuRole(moi.role)} replace />;
    return (
      <Suspense fallback={<EcranChargement />}>
        <Page {...params} />
      </Suspense>
    );
  }

  if (!moi) {
    const retour = encodeURIComponent(window.location.pathname + window.location.search);
    return <Redirect to={`/connexion?retour=${retour}`} replace />;
  }
  if (moi.doitChangerMotDePasse && chemin !== "/bienvenue") return <Redirect to="/bienvenue" replace />;

  const autorise = def.acces === "connecte" || def.acces.includes(moi.role);
  const contenu = autorise ? (
    <Suspense fallback={<EcranChargement />}>
      <Page {...params} />
    </Suspense>
  ) : (
    <PageInterdite />
  );
  if (def.coquille === "aucune") return contenu;
  return <Coquille pleinEcran={def.coquille === "plein-ecran"}>{contenu}</Coquille>;
}

function Routeur() {
  return (
    <Switch>
      {ROUTES.map((def) => (
        <Route key={def.chemin} path={def.chemin}>
          {(params) => <Garde def={def} params={params as Record<string, string>} />}
        </Route>
      ))}
      <Route>
        <PageIntrouvable />
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <FournisseurAuth>
        <FournisseurFlux>
          <Routeur />
          <Toasts />
        </FournisseurFlux>
      </FournisseurAuth>
    </QueryClientProvider>
  );
}
