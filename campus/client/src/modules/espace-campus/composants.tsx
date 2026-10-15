// Briques de l'espace du campus : carrés des cours, gros blocs, en-tête, fenêtres et feuilles.
// « Pense que ce sont des enfants de la maternelle » (José, 14 octobre) puis « des gros blocs, mais un peu de beauté,
// d'esthétique ; faut pas casser la dynamique du campus » (15 octobre, 5 h) : texte courant de 20 px au moins, blocs de
// 120 px de haut au moins sur ordinateur et pleine largeur sur téléphone ; dégradé doux de la couleur du cours, icône
// dans un cercle, ombre légère, réaction au survol et au toucher, point « En direct » vivant (components/ui/gros-blocs).
// Aucun flou (vieux ordinateurs de salle) ; rien qui demande de survoler.
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, CalendarClock, LogOut, MonitorPlay, Pointer, X } from "lucide-react";
import { seDeconnecter } from "@/lib/auth";
import { useTousEvenements } from "@/lib/flux";
import { rafraichir } from "@/lib/queryClient";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { couleurLisible } from "@/modules/cours/outils";
import { CarteCours, CercleIcone, Etiquette, GrosBloc, Pastille, type TonBloc } from "@/components/ui/gros-blocs";
import { t as textesCampus } from "@shared/textes/campus";
import { deCampus, type CarreCampusDto, type RepereCarre } from "@shared/espace-campus";

export { GrosBloc, type TonBloc };

/** Aperçu de la direction : ?site=3 suit toutes les adresses de l'espace. */
export function siteApercu(): string | null {
  if (typeof window === "undefined") return null;
  const n = Number(new URLSearchParams(window.location.search).get("site"));
  return Number.isInteger(n) && n > 0 ? String(n) : null;
}

/** Adresse dans l'espace du campus, avec ?site= en aperçu (et d'autres paramètres au besoin). */
export function lienCampus(chemin: string, params: Record<string, string | number | null | undefined> = {}): string {
  const q = new URLSearchParams();
  const site = siteApercu();
  if (site) q.set("site", site);
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `${chemin}${chemin.includes("?") ? "&" : "?"}${s}` : chemin;
}

/**
 * Lecture d'une adresse de l'API de l'espace (avec ?site= en aperçu) : relue toutes les 60 s (ou `intervalle`), et
 * aussitôt quand un live démarre ou finit (événement temps réel « live »).
 */
export function useApiCampus<T>(chemin: string, intervalle = 60_000) {
  const cle = lienCampus(chemin);
  useTousEvenements((e) => {
    if (e.type === "live") void rafraichir("/api/mon-campus");
  });
  return useQuery<T>({ queryKey: [cle], refetchInterval: intervalle, staleTime: 5_000 });
}

/** Fond et texte d'un carré de la couleur d'un cours (contraste de 4,5 au moins : couleurLisible). */
export const styleCouleur = (couleur: string) => {
  const c = couleurLisible(couleur);
  return { background: c.fond, color: c.texte };
};

/** Bandeau gris de l'aperçu de la direction. */
export function BandeauApercu({ campus }: { campus: string }) {
  const tx = useTextes(textesCampus);
  return <div className="bg-[#E9E5E1] px-4 py-3 text-center text-[18px] font-bold text-encre">{tx("accueil.apercu", { v: { deCampus: deCampus(campus) } })}</div>;
}

/** Bouton « Retour » de 64 px : fond blanc, bord doux, ombre légère, bord orange au survol. */
export function BoutonRetour({ href, libelle }: { href: string; libelle: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-[64px] w-full items-center justify-center gap-3 rounded-[20px] border-2 border-ligne bg-white px-6 text-[22px] font-extrabold text-encre no-underline shadow-carte transition-[border-color,box-shadow] duration-150 hover:border-orange/60 hover:text-encre hover:shadow-survol focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange/50 sm:w-auto sm:justify-start [@media(max-height:700px)]:min-h-[56px]"
      data-retour
    >
      <ArrowLeft className="h-7 w-7 shrink-0 text-orange-profond" strokeWidth={2.25} aria-hidden />
      {libelle}
    </Link>
  );
}

/**
 * Pastille du repère d'un carré : « En direct maintenant » (point vivant), « Salle ouverte · début à 8h30 », « Salle
 * ouverte · le formateur arrive » (après l'heure, la classe attend son formateur), « Aujourd'hui à 8h30 ».
 */
export function PastilleRepere({ repere, heure, grande = false, sansIcone = false }: { repere: RepereCarre; heure: string | null; grande?: boolean; sansIcone?: boolean }) {
  const tx = useTextes(textesCampus);
  if (!repere) return null;
  if (repere === "direct")
    return (
      <Pastille ton="direct" grande={grande}>
        {tx("repere.direct")}
      </Pastille>
    );
  if (repere === "ouvert" || repere === "attente")
    return (
      <Pastille ton="ouvert" grande={grande}>
        {repere === "attente" ? tx("repere.attente") : tx("repere.ouvert", { v: { heure: heure ?? "" } })}
      </Pastille>
    );
  return (
    <Pastille ton="blanc" grande={grande} sansIcone={sansIcone}>
      {tx("repere.aujourdhui", { v: { heure: heure ?? "" } })}
    </Pastille>
  );
}

/** Icône d'un carré : la salle (en direct ou ouverte), le calendrier (aujourd'hui), le livre (les autres cours). */
export function IconeRepere({ repere, className = "h-7 w-7" }: { repere: RepereCarre; className?: string }) {
  const Icone = repere === "direct" || repere === "ouvert" || repere === "attente" ? MonitorPlay : repere === "aujourdhui" ? CalendarClock : BookOpen;
  return <Icone className={className} strokeWidth={2.25} />;
}

/** Un gros carré de cours : dégradé de sa couleur, le repère en haut, l'icône dans un cercle, le code, le nom en très gros. */
export function Carre({ carre, href }: { carre: Pick<CarreCampusDto, "titre" | "couleur" | "repere" | "heure" | "code"> & { classes?: string }; href: string }) {
  return (
    <CarteCours
      href={href}
      couleur={carre.couleur}
      code={carre.code}
      titre={carre.titre}
      classes={carre.classes}
      repere={<PastilleRepere repere={carre.repere} heure={carre.heure} sansIcone />}
      icone={<IconeRepere repere={carre.repere} />}
    />
  );
}

/** Fenêtre de confirmation simple (sans flou ni animation) : un titre, une phrase, « Oui » et « Non » de 72 px. */
export function Confirmation({
  ouverte,
  titre,
  texte,
  details,
  oui,
  non,
  onOui,
  onNon,
  nuit = false,
  danger = false,
  attente = false,
}: {
  ouverte: boolean;
  titre: string;
  texte?: string;
  details?: ReactNode;
  oui: string;
  non: string;
  onOui: () => void;
  onNon: () => void;
  nuit?: boolean;
  danger?: boolean;
  attente?: boolean;
}) {
  useEffect(() => {
    if (!ouverte) return;
    const touche = (e: KeyboardEvent) => e.key === "Escape" && onNon();
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [ouverte, onNon]);
  if (!ouverte) return null;
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-[rgba(15,14,13,.78)] px-4 py-6" role="dialog" aria-modal="true" aria-label={titre} data-confirmation>
      <div className={cn("flex w-full max-w-2xl flex-col gap-5 rounded-[28px] p-6 shadow-survol sm:p-8", nuit ? "border-2 border-nuit-bord bg-nuit-panneau text-white" : "bg-white text-encre")}>
        <p className="text-[32px] font-black leading-tight">{titre}</p>
        {texte && <p className={cn("text-[22px] leading-snug", nuit ? "text-nuit-doux" : "text-texte-doux")}>{texte}</p>}
        {details}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onOui}
            disabled={attente}
            className={cn("min-h-[72px] flex-1 rounded-[20px] px-6 text-[24px] font-black leading-tight disabled:opacity-70 sm:flex-[2]", danger ? "bg-[#C2410C] text-white" : "bg-orange text-encre")}
            data-confirmer
          >
            {oui}
          </button>
          <button
            type="button"
            onClick={onNon}
            className={cn("min-h-[72px] flex-1 rounded-[20px] border-[3px] px-6 text-[24px] font-black leading-tight", nuit ? "border-white text-white" : "border-encre text-encre")}
          >
            {non}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * « Se déconnecter » (lien discret), confirmé : « Se déconnecter de cet ordinateur ? ». Le compte du campus revient à
 * la page simple « Espace du campus » (l'e-mail, le code secret, « Entrer ») ; la direction (aperçu), à la connexion
 * commune.
 */
export function BoutonDeconnexion({ apercu = false }: { apercu?: boolean }) {
  const tx = useTextes(textesCampus);
  const [ouverte, setOuverte] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOuverte(true)}
        className="inline-flex min-h-[48px] items-center gap-2 rounded-full px-3 text-[18px] font-bold text-texte-doux underline-offset-4 hover:bg-white hover:underline"
      >
        <LogOut className="h-5 w-5" aria-hidden />
        {tx("deconnexion")}
      </button>
      <Confirmation
        ouverte={ouverte}
        titre={tx("deconnexion.titre")}
        oui={tx("deconnexion.oui")}
        non={tx("deconnexion.non")}
        onOui={() => void seDeconnecter(apercu ? undefined : `/connexion?retour=${encodeURIComponent("/mon-campus")}`)}
        onNon={() => setOuverte(false)}
      />
    </>
  );
}

/**
 * En-tête de l'espace : bande crème pleine largeur, le logo à gauche, « Se déconnecter » à droite. Sur l'accueil
 * (`accueil`), la bande s'agrandit : « ESPACE DU CAMPUS », « Campus de Yamoussoukro », la date, la consigne. Sur un
 * écran bas (hauteur de 800 px au plus : vieux ordinateurs de salle en 1024×600, portables en 1366×768), elle se resserre : sans l'étiquette,
 * titre de 36 px, la date et la consigne sur une seule ligne, pour que les carrés des cours restent à l'écran.
 */
export function EnTeteCampus({ apercu, campus, accueil }: { apercu?: boolean; campus?: string; accueil?: { libelle: string; consigne: boolean } }) {
  const tx = useTextes(textesCampus);
  return (
    <>
      {apercu && campus && <BandeauApercu campus={campus} />}
      <header className="w-full border-b border-ligne bg-creme" data-entete-campus>
        <div
          className={cn(
            "mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-5 sm:px-8 [@media(max-height:800px)]:gap-2 [@media(max-height:800px)]:pt-3",
            accueil ? "pb-10 [@media(max-height:800px)]:pb-4" : "pb-5 [@media(max-height:800px)]:pb-3",
          )}
        >
          <div className="flex items-center justify-between gap-4">
            {/* Le blanc du logo se fond dans la bande crème (multiply), sans cadre blanc autour. */}
            <img src="/marque-2iae.png" alt="Groupe Écoles 2IAE" className="h-12 w-auto mix-blend-multiply sm:h-14 [@media(max-height:800px)]:!h-10" />
            <BoutonDeconnexion apercu={apercu} />
          </div>
          {accueil && campus && (
            <div className="flex flex-col gap-3 [@media(max-height:800px)]:gap-2">
              <Etiquette className="[@media(max-height:800px)]:hidden">{tx("accueil.etiquette")}</Etiquette>
              <h1 className="text-[44px] leading-[1.02] text-encre sm:text-[60px] [@media(max-height:800px)]:!text-[36px]">{tx("accueil.titre", { v: { deCampus: deCampus(campus) } })}</h1>
              <div className="flex flex-col gap-3 [@media(max-height:800px)]:flex-row [@media(max-height:800px)]:flex-wrap [@media(max-height:800px)]:items-center [@media(max-height:800px)]:gap-x-5 [@media(max-height:800px)]:gap-y-2">
                <p className="text-[22px] text-texte-doux">{accueil.libelle}</p>
                {accueil.consigne && (
                  <p className="mt-1 inline-flex w-fit items-center gap-3 rounded-full bg-white px-5 py-3 text-[20px] font-bold text-encre shadow-carte [@media(max-height:800px)]:mt-0 [@media(max-height:800px)]:py-2">
                    <Pointer className="h-6 w-6 shrink-0 text-orange" strokeWidth={2.25} aria-hidden />
                    {tx("accueil.consigne")}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </header>
    </>
  );
}

/** Page qui charge : une phrase, pas d'animation (« Un instant, la page arrive. »). */
export function Patience() {
  const tx = useTextes(textesCampus);
  return (
    <div className="grid min-h-[50dvh] place-items-center px-4" aria-busy="true">
      <p className="text-[24px] font-bold text-texte-doux">{tx("chargement")}</p>
    </div>
  );
}

/** La page ne s'ouvre pas : une phrase et un gros bouton « Réessayer ». */
export function ErreurCampus({ message, onReessayer }: { message?: string; onReessayer: () => void }) {
  const tx = useTextes(textesCampus);
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 px-4 py-16 text-center">
      <p className="text-[28px] font-black leading-tight">{message ?? tx("accueil.erreur")}</p>
      <button type="button" onClick={onReessayer} className="min-h-[72px] w-full rounded-[20px] bg-orange px-6 text-[24px] font-black text-encre shadow-carte sm:w-auto sm:min-w-[280px]">
        {tx("accueil.reessayer")}
      </button>
    </div>
  );
}

/** Mise en page commune des pages de l'espace (fond blanc, texte encre, 20 px au moins). */
export function PageCampus({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("min-h-dvh bg-white pb-16 text-[20px] text-encre", className)}>{children}</div>;
}

/**
 * Feuille plein écran de l'écran du live (« Ajouter », « Fermer ») : fond nuit presque opaque, sans flou ; contenu
 * centré qui défile (écran bas de 1024×600 compris) ; « Fermer ✕ » de 56 px ; Échap ferme.
 */
export function FeuilleCampus({
  ouverte,
  titre,
  onFermer,
  children,
  retour,
  libelleFermer,
}: {
  ouverte: boolean;
  titre: string;
  onFermer: () => void;
  children: ReactNode;
  retour?: () => void;
  /**
   * Libellé du bouton qui referme la feuille (« Fermer ✕ » par défaut). La feuille « Fermer » dit « ← Retour » : un
   * « Fermer ✕ » qui ne ferme pas la salle y tromperait la personne (relecture du 15 octobre 2026).
   */
  libelleFermer?: string;
}) {
  const tx = useTextes(textesCampus);
  useEffect(() => {
    if (!ouverte) return;
    const touche = (e: KeyboardEvent) => e.key === "Escape" && onFermer();
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [ouverte, onFermer]);
  if (!ouverte) return null;
  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-[rgba(15,14,13,.96)] text-white" role="dialog" aria-modal="true" aria-label={titre} data-feuille>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-8 sm:px-6 sm:py-10">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {retour && (
              <button type="button" onClick={retour} className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 border-nuit-bord text-white hover:border-orange/60" aria-label={tx("feuille.retour")}>
                <ArrowLeft className="h-7 w-7" aria-hidden />
              </button>
            )}
            <p className="min-w-0 break-words text-[34px] font-black leading-tight sm:text-[40px]">{titre}</p>
          </div>
          <button
            type="button"
            onClick={onFermer}
            className="flex min-h-[56px] shrink-0 items-center gap-2 rounded-full border-2 border-nuit-bord px-5 text-[20px] font-bold text-white hover:border-orange/60"
            data-fermer-feuille
          >
            {libelleFermer ? (
              <>
                <ArrowLeft className="h-6 w-6" aria-hidden />
                {libelleFermer}
              </>
            ) : (
              <>
                {tx("feuille.fermer")}
                <X className="h-6 w-6" aria-hidden />
              </>
            )}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Un gros bloc des feuilles nuit : cercle orange doux, titre de 30 px, sous-titre doux ; `danger` : terminer le cours. */
export function BlocNuit({
  icone,
  titre,
  sousTitre,
  onClick,
  danger = false,
  attente = false,
  testId,
  enfants,
}: {
  icone: ReactNode;
  titre: string;
  sousTitre?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  attente?: boolean;
  testId?: string;
  enfants?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={attente || !onClick}
      className={cn(
        "flex min-h-[120px] w-full items-center gap-5 rounded-[28px] border-2 px-5 py-5 text-left transition-[border-color,background-color] duration-150 disabled:cursor-default sm:px-7",
        danger ? "border-[#5A2A1A] bg-[#2A1510] hover:border-[#FF8A6B]/70" : "border-nuit-bord bg-nuit-carte hover:border-orange/60 hover:bg-[#24211F]",
        attente && "opacity-80",
      )}
      data-bloc-nuit={testId}
    >
      <CercleIcone taille={64} fond={danger ? "rgba(255,138,107,.14)" : "rgba(228,121,58,.15)"} couleur={danger ? "#FF8A6B" : "#E4793A"}>
        {icone}
      </CercleIcone>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={cn("break-words text-[26px] font-black leading-tight sm:text-[30px]", danger ? "text-[#FFD2B3]" : "text-white")}>{titre}</span>
        {sousTitre && <span className="text-[20px] font-semibold leading-snug text-nuit-doux">{sousTitre}</span>}
        {enfants}
      </span>
    </button>
  );
}
