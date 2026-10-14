// Application du campus : rassemble les routes de tous les modules,
// applique les droits d'accès et la coquille de navigation.
import { Suspense, useEffect, useState } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { FournisseurAuth, useMoi, accueilDe, accueilDuRole, profilPermet, basculerCasquette, seDeconnecter } from "@/lib/auth";
import { estProfilCampus, libelleProfil, LIBELLES_ROLES, type Casquette, type Role } from "@shared/schema";
import { t as textesCampus } from "@shared/textes/campus";
import { t as textesSalles } from "@shared/textes/salles";
import { FournisseurFlux } from "@/lib/flux";
import { Coquille } from "@/components/layout/coquille";
import { Toasts, toast } from "@/components/ui/toast";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { useTextes } from "@/lib/textes";
import { LogIn, Repeat } from "lucide-react";
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

function PageInterdite({ profil = false }: { profil?: boolean }) {
  const { moi } = useMoi();
  // Tutoiement pour les étudiants, vouvoiement pour les formateurs et l'équipe (CONCEPTION §1.6).
  const tu = !moi || moi.role === "etudiant";
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-24 text-center">
      <span className="etiquette">Accès réservé</span>
      <h1 className="text-3xl font-black">{tu ? "Cette page n'est pas pour ton compte." : "Cette page n'est pas pour votre compte."}</h1>
      <p className="text-texte-pale">
        {profil && moi
          ? `Votre profil (${libelleProfil(moi)}) ne permet pas d'ouvrir cette page. Si vous en avez besoin, demandez à la direction de changer votre profil.`
          : tu
            ? "Elle est réservée à un autre profil du campus. Tu peux revenir à ton accueil."
            : "Elle est réservée à un autre profil du campus. Vous pouvez revenir à votre accueil."}
      </p>
      <LienBouton href={moi ? accueilDe(moi) : "/"}>Revenir à mon accueil</LienBouton>
    </div>
  );
}

/**
 * Double casquette : la page demandée est réservée à l'autre casquette de la personne (le lien du rappel des salles
 * du jour, /pilotage/salles, ouvert depuis le compte formateur). Plutôt qu'un refus, « Cette page est dans votre
 * espace Direction » et un bouton qui bascule et rouvre la même page.
 */
function PageAutreCasquette({ actuel, casquette }: { actuel: Role; casquette: Casquette }) {
  const tx = useTextes(textesSalles);
  const [envoi, setEnvoi] = useState(false);
  const v = { espace: LIBELLES_ROLES[casquette.role], actuel: LIBELLES_ROLES[actuel] };
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-20 text-center sm:py-24">
      <span className="etiquette">{tx("casquette.page.etiquette")}</span>
      <h1 className="text-3xl font-black">{tx("casquette.page.titre", { v })}</h1>
      <p className="text-texte-pale">{tx("casquette.page.texte", { v })}</p>
      <Bouton
        taille="lg"
        className="min-h-[56px] w-full sm:w-auto"
        chargement={envoi}
        icone={<Repeat className="h-5 w-5" />}
        onClick={() => {
          setEnvoi(true);
          basculerCasquette(window.location.pathname + window.location.search + window.location.hash).catch((e) => {
            setEnvoi(false);
            toast((e as Error).message, "erreur");
          });
        }}
      >
        {tx("casquette.page.bouton", { v })}
      </Bouton>
      <LienBouton href={accueilDuRole(actuel)} variante="fantome" className="min-h-[48px]">
        {tx("casquette.page.retour", { v })}
      </LienBouton>
    </div>
  );
}

/**
 * Le lien de l'espace du campus (/mon-campus) ouvert sur un ordinateur déjà connecté avec un autre compte (l'ancien
 * écran « salle », un formateur, un étudiant, la vie scolaire) : au lieu d'un refus qui ramène vers l'autre compte, un
 * gros bouton « Entrer avec le compte du campus » qui déconnecte cet ordinateur et ouvre la page « Espace du campus »
 * (l'e-mail et le code secret), qui revient ensuite à la page demandée.
 */
function PageAutreCompteCampus() {
  const tx = useTextes(textesCampus);
  const { moi } = useMoi();
  const [envoi, setEnvoi] = useState(false);
  const ici = window.location.pathname + window.location.search;
  return (
    <div className="min-h-dvh bg-white text-encre">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-7 px-4 pb-16 pt-8 sm:pt-14">
        <img src="/marque-2iae.png" alt="Groupe Écoles 2IAE" className="h-14 w-auto self-start" />
        <h1 className="text-[36px] font-black leading-tight sm:text-[44px]">{tx("autreCompte.titre")}</h1>
        <p className="text-[22px] leading-snug">{tx("autreCompte.texte")}</p>
        <button
          type="button"
          disabled={envoi}
          onClick={() => {
            setEnvoi(true);
            void seDeconnecter(`/connexion?retour=${encodeURIComponent(ici)}`);
          }}
          className="flex min-h-[120px] w-full items-center justify-center gap-4 rounded-[24px] bg-orange px-6 text-[28px] font-black text-encre disabled:opacity-80 sm:text-[32px]"
          data-autre-compte
        >
          <LogIn className="h-10 w-10 shrink-0" aria-hidden />
          {tx("autreCompte.bouton")}
        </button>
        {moi && (
          <a href={accueilDe(moi)} className="self-start text-[20px] font-bold text-texte-doux underline underline-offset-4">
            {tx("autreCompte.rester")}
          </a>
        )}
      </main>
    </div>
  );
}

/** Pages ouvertes au compte de campus : son espace, et le premier choix du code (lien d'invitation). */
const pageDuCompteCampus = (chemin: string) => chemin === "/mon-campus" || chemin.startsWith("/mon-campus/") || chemin === "/bienvenue";

function PageIntrouvable() {
  const { moi } = useMoi();
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-24 text-center">
      <span className="etiquette">Erreur 404</span>
      <h1 className="text-3xl font-black">Page introuvable.</h1>
      <p className="text-texte-pale">Le lien est peut-être incomplet ou la page a été déplacée.</p>
      <LienBouton href={moi ? accueilDe(moi) : "/"}>Revenir à l'accueil</LienBouton>
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
    if (moi && def.redirigerSiConnecte) return <Redirect to={accueilDe(moi)} replace />;
    return (
      <Suspense fallback={<EcranChargement />}>
        <Page {...params} />
      </Suspense>
    );
  }

  if (!moi) {
    // L'ordinateur d'une salle pas encore installé : la page d'installation de l'écran, pas la connexion.
    if (chemin === "/salle") return <Redirect to="/ecran" replace />;
    const retour = encodeURIComponent(window.location.pathname + window.location.search);
    return <Redirect to={`/connexion?retour=${retour}`} replace />;
  }
  if (moi.doitChangerMotDePasse && chemin !== "/bienvenue") return <Redirect to="/bienvenue" replace />;
  // Compte de campus (l'écran des salles d'un campus) : rien d'autre que son espace (le serveur refuse aussi tout le
  // reste : campus-filtre.ts). Un lien reçu (/live/12, /profil, /salle…) ramène aux carrés de son campus.
  if (estProfilCampus(moi) && !pageDuCompteCampus(chemin)) {
    // Le lien d'une classe (/live/12, reçu par message) : sa page renvoie au carré de ce cours, sans la coquille.
    if (/^\/live\/\d+$/.test(chemin))
      return (
        <Suspense fallback={<EcranChargement />}>
          <Page {...params} />
        </Suspense>
      );
    return <Redirect to="/mon-campus" replace />;
  }

  const autorise = def.acces === "connecte" || def.acces.includes(moi.role);
  // Équipe : le profil doit aussi permettre la page (ext-profils.ts).
  const profilOk = profilPermet(moi, def.droit);
  // Double casquette : page de l'autre casquette (la direction a tous les droits ; une vie scolaire, ceux de son
  // profil, que le client ne connaît pas : seulement les pages sans droit particulier).
  const autreCasquette =
    !autorise && moi.casquette && def.acces !== "connecte" && def.acces.includes(moi.casquette.role) && (moi.casquette.role === "admin" || !def.droit)
      ? moi.casquette
      : null;
  const contenu =
    autorise && profilOk ? (
      <Suspense fallback={<EcranChargement />}>
        <Page {...params} />
      </Suspense>
    ) : autreCasquette ? (
      <PageAutreCasquette actuel={moi.role} casquette={autreCasquette} />
    ) : pageDuCompteCampus(chemin) && chemin !== "/bienvenue" ? (
      <PageAutreCompteCampus />
    ) : (
      <PageInterdite profil={autorise} />
    );
  if (def.coquille === "aucune") return contenu;
  return (
    <Coquille pleinEcran={def.coquille === "plein-ecran"} autreCasquette={Boolean(autreCasquette)}>
      {contenu}
    </Coquille>
  );
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
